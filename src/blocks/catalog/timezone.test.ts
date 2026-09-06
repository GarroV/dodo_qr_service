// T062. Часовой пояс пиццерии — не подпись на карточке, а часть запроса: окно
// чек-листа сравнивается с местным временем (D026), и PostgreSQL переводит момент
// в зону прямо в выборке. Неизвестное имя зоны роняет эту выборку — то есть
// публичный маршрут ВСЕХ станций пиццерии, на каждом сканировании.
import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, test } from "vitest";

import {
  countries,
  getDb,
  getPublishedVersionForStation,
  stations,
  stores,
} from "@/blocks/data";
import { closeTestDb } from "@/blocks/data/testing/db";
import {
  createChecklist,
  createPublishedVersion,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { createCountry } from "./countries";
import { pgErrorCode } from "./errors";
import { createStore, listStores, updateStore } from "./stores";
import {
  assertKnownTimezone,
  isKnownTimezone,
  listTimezones,
} from "./timezone";

const db = getDb();

afterAll(closeTestDb);

const TYPO = "Asia/Almatyy";
const REAL = "Asia/Almaty";
const INSIDE_WINDOW = new Date(Date.UTC(2026, 8, 6, 9, 0, 0));
// invalid_parameter_value: этим кодом PostgreSQL отвечает на неизвестную зону.
const PG_INVALID_PARAMETER_VALUE = "22023";

describe("проверка часового пояса пиццерии", () => {
  test("настоящие зоны проходят", async () => {
    for (const name of [REAL, "Europe/Belgrade", "Asia/Tashkent", "UTC"]) {
      expect(await isKnownTimezone(name), name).toBe(true);
    }
  });

  test("опечатка в имени зоны не проходит", async () => {
    expect(await isKnownTimezone(TYPO)).toBe(false);

    await expect(assertKnownTimezone(TYPO)).rejects.toMatchObject({
      code: "unknownTimezone",
    });
  });

  test("пустое значение и мусор не проходят", async () => {
    for (const value of ["", "   ", "Moscow", "Europe/", "'; drop table"]) {
      await expect(assertKnownTimezone(value), value).rejects.toMatchObject({
        code: "unknownTimezone",
      });
    }
  });

  test("имя приводится к каноническому написанию", async () => {
    // PostgreSQL принимает `asia/almaty` в запросе, но в справочнике должно лежать
    // одно написание: иначе две одинаковые пиццерии выглядят разными.
    expect(await assertKnownTimezone(" asia/almaty ")).toBe(REAL);
  });

  test("список зон для формы — настоящие зоны с смещением, без служебных префиксов", async () => {
    const list = await listTimezones();

    expect(list.length).toBeGreaterThan(100);
    expect(list.map((zone) => zone.name)).toContain(REAL);
    expect(list.every((zone) => !zone.name.startsWith("posix/"))).toBe(true);
    expect(list.every((zone) => !zone.name.startsWith("right/"))).toBe(true);
    expect(list.find((zone) => zone.name === REAL)?.offset).toBe("UTC+5");
    // Порядок по имени: список из полутысячи строк без порядка не читается.
    const names = list.map((zone) => zone.name);
    expect(names).toStrictEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("почему проверка обязательна", () => {
  test("пиццерия с опечаткой в зоне роняет публичный маршрут своих станций", async () => {
    // Записываем зону мимо справочника — так, как она попадёт туда из сида, миграции
    // или любого будущего кода без проверки. Симптом виден только на сканировании.
    const suffix = randomUUID().slice(0, 8);
    const [country] = await db
      .insert(countries)
      .values({ name: `Страна ${suffix}`, locale: "ru" })
      .returning({ id: countries.id });
    if (country === undefined) throw new Error("страна не завелась");
    const [store] = await db
      .insert(stores)
      .values({
        countryId: country.id,
        name: `Пиццерия ${suffix}`,
        timezone: TYPO,
      })
      .returning({ id: stores.id });
    if (store === undefined) throw new Error("пиццерия не завелась");
    const code = `zz${suffix}`;
    const [station] = await db
      .insert(stations)
      .values({ storeId: store.id, name: `Станция ${suffix}`, code })
      .returning({ id: stations.id });
    if (station === undefined) throw new Error("станция не завелась");
    const checklistId = await createChecklist({ stationId: station.id });
    await createPublishedVersion(checklistId, sampleSections("пояс"));

    const failure: unknown = await getPublishedVersionForStation(
      code,
      INSIDE_WINDOW,
    ).catch((error: unknown) => error);

    // 22023 — invalid_parameter_value: «time zone "Asia/Almatyy" not recognized».
    // Сканирование любой станции этой пиццерии кончается исключением, а не чек-листом.
    expect(pgErrorCode(failure)).toBe(PG_INVALID_PARAMETER_VALUE);
  });
});

/** Страна, к которой цепляется пиццерия: имя уникальное, тесты идут параллельно. */
async function someCountry(): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  return createCountry({ name: `Страна ${suffix}`, locale: "ru" });
}

describe("пиццерия не принимает несуществующий пояс (T062)", () => {
  test("создание с опечаткой в зоне отказывает, а не пишет её в базу", async () => {
    const countryId = await someCountry();

    await expect(
      createStore({ countryId, name: "Алматы, Абая 44", timezone: TYPO }),
    ).rejects.toMatchObject({ code: "unknownTimezone" });

    expect(await listStores(countryId)).toStrictEqual([]);
  });

  test("правка на опечатку отказывает, а прежний пояс остаётся", async () => {
    const countryId = await someCountry();
    const storeId = await createStore({
      countryId,
      name: "Алматы, Абая 44",
      timezone: REAL,
    });

    await expect(
      updateStore(storeId, { name: "Алматы, Абая 44", timezone: TYPO }),
    ).rejects.toMatchObject({ code: "unknownTimezone" });

    expect((await listStores(countryId))[0]?.timezone).toBe(REAL);
  });

  test("пустой и пробельный пояс тоже не проходят", async () => {
    const countryId = await someCountry();

    for (const value of ["", "   "]) {
      await expect(
        createStore({ countryId, name: "Астана", timezone: value }),
        JSON.stringify(value),
      ).rejects.toMatchObject({ code: "unknownTimezone" });
    }
  });

  test("настоящий пояс проходит и записывается в каноническом написании", async () => {
    const countryId = await someCountry();

    const storeId = await createStore({
      countryId,
      name: "Алматы, Абая 44",
      timezone: "asia/almaty",
    });

    expect((await listStores(countryId))[0]?.timezone).toBe(REAL);
    // И тогда публичный маршрут станции этой пиццерии работает, а не падает.
    expect(storeId).toBeTruthy();
  });
});
