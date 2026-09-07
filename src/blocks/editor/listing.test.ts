// Список чек-листов и список станций для экрана. Оба запроса читают чужие таблицы
// (справочник блока catalog, заполнения блока fill) — через схему и getDb() слоя data,
// как велит D024. Проверяются на настоящей базе: смысл здесь в SQL.
import { afterAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import {
  checklists,
  getDb,
  saveSubmission,
  stations,
  stores,
} from "@/blocks/data";
import { closeTestDb } from "@/blocks/data/testing/db";
import {
  createPublishedVersion,
  createStation,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { createChecklist, saveDraft } from "./drafts";
import { listChecklists, listStations } from "./listing";

afterAll(closeTestDb);

const MORNING = { start: "06:00", end: "11:00" };

describe("listChecklists", () => {
  test("строка списка отвечает на вопросы экрана: где, когда, какая версия, сколько пунктов", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Открытие кухни", en: "Kitchen opening" },
      window: MORNING,
    });
    await saveDraft(checklistId, sampleSections("список"));
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("опубликованный"),
    );
    await saveSubmission({
      versionId,
      answers: [{ itemId: "item-опубликованный", value: true, at: Date.now() }],
      startedAt: Date.now(),
    });

    const row = (await listChecklists()).find(
      (entry) => entry.id === checklistId,
    );

    expect(row).toMatchObject({
      title: { ru: "Открытие кухни", en: "Kitchen opening" },
      windowStart: "06:00:00",
      windowEnd: "11:00:00",
      publishedNumber: 1,
      hasDraft: true,
      itemCount: 1,
      submissions7d: 1,
    });
    expect(row?.stationName).toContain("Станция");
    expect(row?.storeName).toContain("Пиццерия");
    expect(row?.countryName).toContain("Страна");
  });

  test("чек-лист без станции и без публикации показывается, а не пропадает из списка", async () => {
    // Иначе только что заведённый чек-лист исчезает с экрана, и методист заводит второй.
    const checklistId = await createChecklist({
      stationId: null,
      title: { ru: "Заготовка" },
      window: MORNING,
    });

    const row = (await listChecklists()).find(
      (entry) => entry.id === checklistId,
    );

    expect(row).toBeDefined();
    expect(row?.stationName).toBeNull();
    expect(row?.publishedNumber).toBeNull();
    expect(row?.hasDraft).toBe(true);
  });

  test("чек-листы одной пиццерии идут подряд: список читается как путь", async () => {
    const station = await createStation();
    const second = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Ббб" },
      window: MORNING,
    });
    const first = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Ааа" },
      window: MORNING,
    });

    const mine = (await listChecklists())
      .filter((entry) => entry.id === first || entry.id === second)
      .map((entry) => entry.id);

    expect(mine).toStrictEqual([first, second]);
  });
});

describe("listChecklists и снятые с работы", () => {
  test("снятый с работы чек-лист из списка уходит, а соседний остаётся", async () => {
    // Смысл удаления для методиста — «этого больше нет в работе». Если снятый чек-лист
    // остаётся в списке, он заводит второй такой же и путается в них.
    const station = await createStation();
    const kept = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Остаётся" },
      window: MORNING,
    });
    const removed = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Снят с работы" },
      window: MORNING,
    });

    await getDb()
      .update(checklists)
      .set({ archivedAt: new Date() })
      .where(eq(checklists.id, removed));

    const ids = (await listChecklists()).map((row) => row.id);
    expect(ids).toContain(kept);
    expect(ids).not.toContain(removed);
  });
});

describe("listStations", () => {
  test("станция приходит вместе с пиццерией и страной: в списке их различают по адресу", async () => {
    const station = await createStation();

    const option = (await listStations()).find(
      (entry) => entry.id === station.stationId,
    );

    expect(option?.name).toContain("Станция");
    expect(option?.storeName).toContain("Пиццерия");
    expect(option?.countryName).toContain("Страна");
  });

  test("станции одной пиццерии идут подряд и по алфавиту", async () => {
    const station = await createStation();
    const db = getDb();
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.id, station.storeId));
    if (store === undefined) throw new Error("Пиццерии нет");

    const inserted = await db
      .insert(stations)
      .values([
        { storeId: store.id, name: "Ящик", code: `z${station.stationCode}` },
        { storeId: store.id, name: "Абрикос", code: `a${station.stationCode}` },
      ])
      .returning({ id: stations.id, name: stations.name });

    const all = await listStations();
    const mine = all
      .filter((entry) => inserted.some((row) => row.id === entry.id))
      .map((entry) => entry.name);

    expect(mine).toStrictEqual(["Абрикос", "Ящик"]);
  });
});
