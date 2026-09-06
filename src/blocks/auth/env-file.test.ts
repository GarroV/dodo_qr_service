// Значение переменной окружения обязано доезжать до кода тем же, каким его записали.
// Next при старте зовёт загрузчик `.env`, а тот пропускает значения через подстановку
// `$переменная` — и делает это не только со строками из файла, но и с теми, что уже
// лежат в окружении процесса, если файл упоминает то же имя. Всё, что похоже на `$имя`,
// заменяется пустотой молча. Здесь проверяется, что хэш пароля этого не боится:
// иначе вход в админку ломается ровно у того, кто выполнил инструкцию проекта.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Загрузчик берётся настоящий, тот же, что зовёт Next: своя копия его поведения
// проверяла бы копию, а не продукт.
import nextEnv from "@next/env";
import { afterEach, describe, expect, test } from "vitest";

import { hashPassword, verifyPassword } from "./password";

const { loadEnvConfig, updateInitialEnv } = nextEnv;

const HASH_VARIABLE = "ADMIN_PASSWORD_HASH";
const PASSWORD = "пароль-методиста";
// Дешёвые параметры: тест проверяет формат строки, а не стойкость перебору.
const CHEAP = { cost: 1024, blockSize: 8, parallelization: 1 };

/**
 * Прогоняет окружение через загрузчик Next на временном каталоге с заданным `.env`.
 * `outer` — то, что уже стоит в окружении процесса до загрузки (так делает playwright).
 */
function loadEnvFile(contents: string, outer: Record<string, string>): void {
  const directory = mkdtempSync(path.join(tmpdir(), "dodo-env-"));
  writeFileSync(path.join(directory, ".env"), contents, "utf8");

  // Переменная могла приехать из `.env` самого проекта (его читает подготовка тестовой
  // базы). Окружение для этой проверки задаётся здесь целиком, иначе тест зависел бы
  // от того, скопировал ли разработчик пример в `.env`.
  Reflect.deleteProperty(process.env, HASH_VARIABLE);
  updateInitialEnv({ [HASH_VARIABLE]: undefined });

  for (const [name, value] of Object.entries(outer)) process.env[name] = value;
  // Загрузчик помнит снимок окружения с первого вызова и откатывает к нему: без этого
  // второй вызов в том же процессе стёр бы только что выставленные значения.
  updateInitialEnv(outer);

  loadEnvConfig(directory, false, console, true);
}

afterEach(() => {
  Reflect.deleteProperty(process.env, HASH_VARIABLE);
  updateInitialEnv({ [HASH_VARIABLE]: undefined });
});

describe("хэш пароля переживает загрузку .env", () => {
  test("хэш, записанный в .env по инструкции проекта, доезжает до проверки пароля целым", async () => {
    const hash = await hashPassword(PASSWORD, CHEAP);

    loadEnvFile(`${HASH_VARIABLE}=${hash}\n`, {});

    expect(process.env[HASH_VARIABLE]).toBe(hash);
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
  });

  test("значение из окружения не портится, когда .env упоминает ту же переменную пустой", async () => {
    const hash = await hashPassword(PASSWORD, CHEAP);

    // Ровно случай прогона сквозных сценариев: значение приходит снаружи,
    // а скопированный из .env.example файл упоминает имя с пустым значением.
    loadEnvFile(`${HASH_VARIABLE}=\n`, { [HASH_VARIABLE]: hash });

    expect(process.env[HASH_VARIABLE]).toBe(hash);
  });
});
