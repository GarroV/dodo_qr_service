// Накат с нуля и откат проверяются на выброшенной базе: она создаётся пустой,
// проходит полный путь и удаляется. На общей тестовой базе такое не проверить —
// параллельные файлы тестов работают с её таблицами прямо сейчас.
import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { applyMigrations, rollbackLastMigration } from "./migrator";
import { dropDatabase, ensureDatabase } from "./testing/admin";
import { testDatabaseUrl } from "./testing/db";

const PRODUCT_TABLES = [
  "countries",
  "stores",
  "stations",
  "checklists",
  "checklist_versions",
  "blocks",
  "submissions",
];

const throwawayUrl = (): URL => {
  const url = new URL(testDatabaseUrl());
  url.pathname = `/rollback_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  return url;
};

const url = throwawayUrl();
let pool: Pool;

async function tableNames(): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  return result.rows.map((row) => row.table_name);
}

async function columnNames(table: string): Promise<string[]> {
  const result = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

/** Откатывает миграции по одной, пока откатывать нечего: возвращает их в порядке отката. */
async function rollbackAll(): Promise<string[]> {
  const rolledBack: string[] = [];
  let tag = await rollbackLastMigration(pool);
  while (tag !== null) {
    rolledBack.push(tag);
    tag = await rollbackLastMigration(pool);
  }
  return rolledBack;
}

beforeAll(async () => {
  await ensureDatabase(url);
  pool = new Pool({ connectionString: url.toString() });
});

afterAll(async () => {
  await pool.end();
  await dropDatabase(url);
});

describe("миграции на пустой базе", () => {
  test("накатываются с нуля и создают все таблицы продукта", async () => {
    expect(await tableNames()).toStrictEqual([]);

    await applyMigrations(pool);

    const names = await tableNames();
    for (const table of PRODUCT_TABLES) {
      expect(names).toContain(table);
    }
  });

  test("откат снимает миграции по одной с конца и очищает журнал", async () => {
    const rolledBack = await rollbackAll();

    // Откат идёт от последней миграции к первой: обратный порядок — это его смысл,
    // иначе обратный файл сработал бы раньше того, что он должен отменить.
    expect(rolledBack.at(-1)).toBe("0000_init");
    expect(rolledBack).toStrictEqual([...rolledBack].sort().reverse());
    expect(await tableNames()).toStrictEqual([]);
    const journal = await pool.query<{ count: string }>(
      "select count(*)::text as count from drizzle.__drizzle_migrations",
    );
    expect(journal.rows[0]?.count).toBe("0");
  });

  test("после отката накатываются снова, со всеми колонками поздних миграций", async () => {
    await applyMigrations(pool);

    expect(await tableNames()).toContain("checklist_versions");
    // Замороженная станция версии (T056) появляется на пустой базе, а не только
    // на базе, доросшей до неё правками: миграции обязаны работать с нуля.
    expect(await columnNames("checklist_versions")).toContain("station_id");
  });

  test("откатывать нечего — возвращает null, а не падает", async () => {
    await rollbackAll();

    expect(await rollbackLastMigration(pool)).toBeNull();
  });
});
