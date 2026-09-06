// Служебные операции над самой базой: создать и удалить. Нужны прогону тестов —
// тестовая база готовится с нуля, а откат миграций проверяется на выброшенной копии,
// чтобы не мешать параллельным файлам тестов.
import { Pool } from "pg";

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function databaseNameFrom(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

/** Подключение к служебной базе `postgres` того же сервера. */
function adminUrl(url: URL): string {
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  return admin.toString();
}

export function unreachableDatabase(url: URL, cause: unknown): Error {
  return new Error(
    `База ${url.host} недоступна. Поднимите её: docker compose -p <имя-стенда> up -d db. ` +
      `Причина: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

async function onAdminConnection<T>(
  url: URL,
  action: (pool: Pool) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: adminUrl(url) });
  try {
    return await action(pool);
  } catch (cause) {
    throw unreachableDatabase(url, cause);
  } finally {
    await pool.end();
  }
}

/** Создаёт базу, если её ещё нет. Имя подставляется идентификатором: параметры в CREATE DATABASE не работают. */
export async function ensureDatabase(url: URL): Promise<void> {
  const name = databaseNameFrom(url);
  await onAdminConnection(url, async (pool) => {
    const existing = await pool.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (existing.rowCount === 0) {
      await pool.query(`create database ${quoteIdentifier(name)}`);
    }
  });
}

export async function dropDatabase(url: URL): Promise<void> {
  const name = databaseNameFrom(url);
  await onAdminConnection(url, async (pool) => {
    await pool.query(
      `drop database if exists ${quoteIdentifier(name)} with (force)`,
    );
  });
}
