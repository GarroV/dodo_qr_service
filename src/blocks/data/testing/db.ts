// Подключение к тестовой базе. Тесты слоя доступа идут на настоящем PostgreSQL:
// заглушка не ловит ошибку в SQL, а весь смысл этого блока — SQL.
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../schema";

const TEST_DATABASE_SUFFIX = "_test";

/**
 * Адрес по умолчанию — ровно то, что поднимает `docker-compose.yml` проекта (и что
 * записано в `.env.example`). Без умолчания прогон в свежем клоне не стартовал вовсе:
 * падал раньше первого теста, показывая нулевое покрытие вместо провала (T063).
 * База по этому адресу может не подняться — тогда ошибка приходит от `unreachableDatabase`
 * и говорит, какой командой её поднять, то есть пропущенной проверки не бывает.
 */
const DEFAULT_TEST_DATABASE_URL =
  "postgres://dodo:dodo@localhost:5433/dodo_qr_test";

let envLoaded = false;

/** Читает .env один раз: vitest сам переменные окружения проекта не подхватывает. */
function loadEnvOnce(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile();
  } catch {
    // .env может не быть — тогда работают переменные окружения снаружи.
  }
}

/**
 * Адрес тестовой базы: TEST_DATABASE_URL, иначе рабочая база с суффиксом `_test`,
 * иначе адрес из `docker-compose.yml` — прогон должен стартовать и без `.env`.
 * Отдельная база, чтобы прогон тестов не сносил данные, с которыми работает разработчик.
 */
export function testDatabaseUrl(): string {
  loadEnvOnce();
  const explicit = process.env["TEST_DATABASE_URL"];
  if (explicit !== undefined && explicit !== "") return explicit;

  const main = process.env["DATABASE_URL"];
  if (main === undefined || main === "") return DEFAULT_TEST_DATABASE_URL;
  const url = new URL(main);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${TEST_DATABASE_SUFFIX}`;
  return url.toString();
}

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

/** Пул на процесс воркера vitest: одно подключение на весь файл тестов. */
export function getTestDb(): NodePgDatabase<typeof schema> {
  if (database === undefined) {
    pool = new Pool({ connectionString: testDatabaseUrl() });
    database = drizzle(pool, { schema });
  }
  return database;
}

/** Закрывает пул: без этого vitest висит на открытых соединениях. */
export async function closeTestDb(): Promise<void> {
  if (pool !== undefined) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}
