// Прогон обязан стартовать в свежем клоне, где `.env` ещё нет: иначе `scripts/check`
// падает раньше первого теста и показывает нулевое покрытие вместо провала проверки (T063).
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { testDatabaseUrl } from "./db";

const TEST_VARIABLE = "TEST_DATABASE_URL";
const MAIN_VARIABLE = "DATABASE_URL";

/** Умолчание — не литерал в тесте, а то же значение, что записано в `.env.example`. */
function fromExample(name: string): string {
  const example = readFileSync(
    path.join(process.cwd(), ".env.example"),
    "utf8",
  );
  const found = new RegExp(`^${name}=(.+)$`, "m").exec(example);
  const value = found?.[1];
  if (value === undefined)
    throw new Error(`${name} не заполнен в .env.example`);
  return value;
}

const OUTER = {
  test: process.env[TEST_VARIABLE],
  main: process.env[MAIN_VARIABLE],
};

function forget(): void {
  Reflect.deleteProperty(process.env, TEST_VARIABLE);
  Reflect.deleteProperty(process.env, MAIN_VARIABLE);
}

afterEach(() => {
  forget();
  if (OUTER.test !== undefined) process.env[TEST_VARIABLE] = OUTER.test;
  if (OUTER.main !== undefined) process.env[MAIN_VARIABLE] = OUTER.main;
});

describe("адрес тестовой базы", () => {
  test("без переменных окружения — тот же адрес, что в .env.example и docker-compose.yml", () => {
    forget();

    expect(testDatabaseUrl()).toBe(fromExample(TEST_VARIABLE));
  });

  test("заданный TEST_DATABASE_URL важнее умолчания", () => {
    forget();
    process.env[TEST_VARIABLE] = "postgres://dodo:dodo@localhost:5999/custom";

    expect(testDatabaseUrl()).toBe(
      "postgres://dodo:dodo@localhost:5999/custom",
    );
  });

  test("без TEST_DATABASE_URL берётся рабочая база с суффиксом _test", () => {
    forget();
    process.env[MAIN_VARIABLE] = "postgres://dodo:dodo@localhost:5999/working";

    expect(testDatabaseUrl()).toBe(
      "postgres://dodo:dodo@localhost:5999/working_test",
    );
  });
});
