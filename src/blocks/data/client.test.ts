// T060: пул соединений без таймаутов. Настоящий PostgreSQL — единственный, кто знает,
// какой statement_timeout видит сессия и как пул ведёт себя, когда все соединения заняты:
// заглушкой это не проверить, а именно тут прячется риск зависшего под нагрузкой пула.
import { setTimeout as delay } from "node:timers/promises";

import { sql } from "drizzle-orm";
import type { Pool, PoolClient } from "pg";
import { describe, expect, test } from "vitest";

import { getDb } from "./client";

const EXPECTED_STATEMENT_TIMEOUT_MS = 10_000;
const EXPECTED_CONNECTION_TIMEOUT_MS = 3_000;
const EXPECTED_POOL_MAX = 10;

// Сторож ждёт вдвое дольше настроенного таймаута ожидания соединения: если пул
// исправен, отказ приходит намного раньше и сторож просто не успевает сработать.
const CONNECT_SENTINEL_MS = EXPECTED_CONNECTION_TIMEOUT_MS * 2;
const TEST_TIMEOUT_MS = 30_000;

interface PoolHolder {
  meridiusPool?: Pool;
}

/**
 * Достаёт живой пул продукта из globalThis тем же приёмом, что и сам client.ts:
 * пул не экспортирован, а тест обязан видеть настоящие соединения, а не пересоздавать свои.
 */
function appPool(): Pool {
  getDb(); // getDb создаёт пул при первом обращении
  const pool = (globalThis as PoolHolder).meridiusPool;
  if (pool === undefined) {
    throw new Error("Пул продукта не создан: getDb() его не завёл");
  }
  return pool;
}

describe("пул соединений", () => {
  test("серверный предел времени запроса стоит на соединениях пула", async () => {
    const db = getDb();

    const result = await db.execute<{ setting: string }>(
      sql`select setting from pg_settings where name = 'statement_timeout'`,
    );

    expect(result.rows[0]?.setting).toBe(String(EXPECTED_STATEMENT_TIMEOUT_MS));
  });

  test(
    "пул отказывает, когда все соединения заняты, а не копит очередь",
    async () => {
      const pool = appPool();
      const held: PoolClient[] = [];
      try {
        for (let index = 0; index < EXPECTED_POOL_MAX; index += 1) {
          held.push(await pool.connect());
        }

        const started = Date.now();
        const sentinel = new AbortController();
        const hung = delay(CONNECT_SENTINEL_MS, "повис в очереди", {
          signal: sentinel.signal,
        }).catch(() => "сторож снят");
        const attempt = pool
          .connect()
          .then((extra) => {
            held.push(extra);
            return "выдал соединение сверх предела";
          })
          .catch(
            (error: unknown) =>
              `отказал: ${error instanceof Error ? error.message : String(error)}`,
          );

        const outcome = await Promise.race([attempt, hung]);
        sentinel.abort();

        expect(outcome).toMatch(/^отказал: .*timeout/i);
        expect(Date.now() - started).toBeLessThan(CONNECT_SENTINEL_MS);
      } finally {
        for (const client of held) client.release();
      }
    },
    TEST_TIMEOUT_MS,
  );
});
