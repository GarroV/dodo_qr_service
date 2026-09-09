// Прогон обязан стартовать в свежем клоне, где `.env` ещё нет: иначе `scripts/check`
// падает раньше первого теста и показывает нулевое покрытие вместо провала проверки (T063).
// И он обязан идти в свою базу: адрес, общий на все копии репозитория, роняет соседний
// прогон случайным на вид падением (T070).
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { repositoryCopyId } from "@/blocks/core/repo-copy";

import { testDatabaseUrl } from "./db";

const TEST_VARIABLE = "TEST_DATABASE_URL";
const MAIN_VARIABLE = "DATABASE_URL";

function readExample(): string {
  return readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
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
  test("без переменных окружения — сервер из docker-compose.yml и своя база копии", () => {
    forget();

    expect(testDatabaseUrl()).toBe(
      `postgres://dodo:dodo@localhost:5433/meridius_test_${repositoryCopyId()}`,
    );
  });

  test("заданный TEST_DATABASE_URL важнее умолчания", () => {
    forget();
    process.env[TEST_VARIABLE] = "postgres://dodo:dodo@localhost:5999/custom";

    expect(testDatabaseUrl()).toBe(
      "postgres://dodo:dodo@localhost:5999/custom",
    );
  });

  test("без TEST_DATABASE_URL берётся рабочая база с суффиксом _test и меткой копии", () => {
    forget();
    process.env[MAIN_VARIABLE] = "postgres://dodo:dodo@localhost:5999/working";

    expect(testDatabaseUrl()).toBe(
      `postgres://dodo:dodo@localhost:5999/working_test_${repositoryCopyId()}`,
    );
  });

  test("имя базы не общее: другая копия репозитория получила бы другое имя", () => {
    forget();

    const here = new URL(testDatabaseUrl()).pathname;
    const elsewhere = repositoryCopyId("/Users/kto-to/copy/dodo_qr_service");

    expect(here).toContain(repositoryCopyId());
    expect(here).not.toContain(elsewhere);
  });

  test(".env.example не закрепляет общее имя тестовой базы", () => {
    // Пример копируют в `.env` все копии сразу. Закреплённое здесь имя вернуло бы
    // общую базу ровно в том состоянии, в котором проект и проверяют.
    expect(readExample()).not.toMatch(new RegExp(`^${TEST_VARIABLE}=`, "m"));
    // Но переменная остаётся описанной: без упоминания её не найдёт тот, кому нужен стенд.
    expect(readExample()).toContain(TEST_VARIABLE);
  });
});
