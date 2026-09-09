// База для сквозных сценариев. Экраны редактора читают и пишут настоящие данные,
// поэтому серверу прогона нужна своя база — не рабочая (её снесла бы подготовка) и не
// тестовая (её пересоздаёт vitest посреди прогона).
//
// Имя базы несёт метку копии репозитория: параллельные копии стройки иначе снесли бы
// схему друг у друга ровно так же, как это было с тестовой базой (T070).
import { Pool } from "pg";

import { repositoryCopyId } from "../src/blocks/core/repo-copy";
import { applyMigrations } from "../src/blocks/data/migrator";
import {
  ensureDatabase,
  unreachableDatabase,
} from "../src/blocks/data/testing/admin";

const SUFFIX = `_e2e_${repositoryCopyId()}`;

// То же умолчание, что у docker-compose.yml и .env.example: прогон обязан стартовать
// в свежем клоне без .env — там переменной нет вовсе, а база уже поднята.
const DEFAULT_URL = `postgres://dodo:dodo@localhost:5433/meridius${SUFFIX}`;

let envLoaded = false;

function loadEnvOnce(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile();
  } catch {
    // .env может не быть — тогда работают переменные снаружи и умолчание.
  }
}

/** Адрес базы сквозных сценариев: рабочий адрес с суффиксом `_e2e_<копия>`. */
export function e2eDatabaseUrl(): string {
  loadEnvOnce();
  const main = process.env["DATABASE_URL"];
  if (main === undefined || main === "") return DEFAULT_URL;
  const url = new URL(main);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${SUFFIX}`;
  return url.toString();
}

/**
 * Готовит базу прогона с нуля: создаёт, если её нет, сносит схему и накатывает миграции.
 * Так сценарии не зависят ни от порядка запуска, ни от того, что осталось с прошлого раза.
 */
export async function prepareE2eDatabase(): Promise<void> {
  const url = new URL(e2eDatabaseUrl());
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

export interface SeededStation {
  stationId: string;
  stationName: string;
  storeName: string;
  countryName: string;
}

/**
 * Страна → пиццерия → станция для сценария. Справочник ведёт блок `catalog`, но заводить
 * станцию через его экран значит проверять чужой блок: сценарию нужна только цель привязки.
 */
export async function seedStation(label: string): Promise<SeededStation> {
  const pool = new Pool({ connectionString: e2eDatabaseUrl() });
  try {
    const country = await pool.query<{ id: string }>(
      "insert into countries (name, locale) values ($1, 'ru') returning id",
      [`Страна ${label}`],
    );
    const store = await pool.query<{ id: string }>(
      "insert into stores (country_id, name, timezone) values ($1, $2, 'UTC') returning id",
      [country.rows[0]?.id, `Пиццерия ${label}`],
    );
    const station = await pool.query<{ id: string }>(
      "insert into stations (store_id, name, code) values ($1, $2, $3) returning id",
      [store.rows[0]?.id, `Станция ${label}`, `e2e${label}`.slice(0, 10)],
    );
    const id = station.rows[0]?.id;
    if (id === undefined) throw new Error("Станция для сценария не завелась");
    return {
      stationId: id,
      stationName: `Станция ${label}`,
      storeName: `Пиццерия ${label}`,
      countryName: `Страна ${label}`,
    };
  } finally {
    await pool.end();
  }
}
