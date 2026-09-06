// Накат и откат миграций. Накат — штатный механизм Drizzle; откат свой, потому что
// drizzle-kit обратных файлов не пишет, а критерий готовности блока требует отката.
// Обратный файл лежит рядом с прямым: `0000_init.sql` → `0000_init.down.sql`.
import { readFile } from "node:fs/promises";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

const MIGRATIONS_FOLDER = new URL("./migrations", import.meta.url).pathname;

const JOURNAL_PATH = `${MIGRATIONS_FOLDER}/meta/_journal.json`;
const MIGRATIONS_TABLE = "drizzle.__drizzle_migrations";

interface JournalEntry {
  idx: number;
  tag: string;
}

async function journalEntries(): Promise<JournalEntry[]> {
  const raw = await readFile(JOURNAL_PATH, "utf8");
  const parsed = JSON.parse(raw) as { entries?: JournalEntry[] };
  return parsed.entries ?? [];
}

export async function applyMigrations(pool: Pool): Promise<void> {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
}

async function migrationsTableExists(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ present: boolean }>(
    `select to_regclass('${MIGRATIONS_TABLE}') is not null as present`,
  );
  return result.rows[0]?.present === true;
}

/**
 * Откатывает последнюю применённую миграцию: выполняет её обратный файл и убирает
 * запись из журнала Drizzle. Возвращает имя откаченной миграции или `null`,
 * если откатывать нечего. Обратный файл и удаление записи идут одной транзакцией:
 * иначе неудачный откат оставит журнал врущим о состоянии базы.
 */
export async function rollbackLastMigration(
  pool: Pool,
): Promise<string | null> {
  if (!(await migrationsTableExists(pool))) return null;

  const applied = await pool.query<{ id: number }>(
    `select id from ${MIGRATIONS_TABLE} order by created_at desc, id desc`,
  );
  const last = applied.rows[0];
  if (last === undefined) return null;

  const entries = await journalEntries();
  const entry = entries[applied.rows.length - 1];
  if (entry === undefined) {
    throw new Error(
      `Журнал миграций короче, чем список применённых (${String(applied.rows.length)}): каталог миграций не тот`,
    );
  }

  const downSql = await readFile(
    `${MIGRATIONS_FOLDER}/${entry.tag}.down.sql`,
    "utf8",
  );

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(downSql);
    await client.query(`delete from ${MIGRATIONS_TABLE} where id = $1`, [
      last.id,
    ]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return entry.tag;
}
