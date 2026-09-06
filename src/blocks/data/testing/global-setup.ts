// Готовит тестовую базу один раз на прогон: создаёт её, если нет, сносит схему
// и накатывает миграции с нуля. Заодно это постоянная проверка требования
// «миграции применяются на пустую базу»: каждый прогон начинается с пустой.
import { Pool } from "pg";

import { applyMigrations } from "../migrator";
import { ensureDatabase, unreachableDatabase } from "./admin";
import { testDatabaseUrl } from "./db";

export default async function setup(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  await ensureDatabase(url);

  const pool = new Pool({ connectionString: url.toString() });
  try {
    await pool.query("drop schema if exists public cascade");
    await pool.query("create schema public");
    await pool.query("drop schema if exists drizzle cascade");
    await applyMigrations(pool);
  } catch (cause) {
    throw unreachableDatabase(url, cause);
  } finally {
    await pool.end();
  }
}
