// Публикация версии из черновика. Здесь живёт ключевое правило продукта: вставленный
// блок библиотеки разворачивается в снимок на момент публикации (D002). Пока блок вставлен
// ссылкой, его правка приходит в черновики; опубликованная версия не меняется больше никогда.
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import type { Item, Section } from "@/blocks/data";
import { blocks, checklistVersions, getDraft } from "@/blocks/data";
import { closeTestDb, getTestDb } from "@/blocks/data/testing/db";
import { createStation, sampleSections } from "@/blocks/data/testing/fixtures";

import { createChecklist, loadEditor, saveDraft } from "./drafts";
import { publish } from "./publish";

const db = getTestDb();

afterAll(closeTestDb);

const MORNING = { start: "06:00", end: "11:00" };

async function newChecklist(): Promise<string> {
  const station = await createStation();
  return createChecklist({
    stationId: station.stationId,
    title: { ru: "Открытие кухни", en: "Kitchen opening" },
    window: MORNING,
  });
}

function libraryItem(label: string): Item {
  return {
    id: `item-${label}`,
    title: { ru: `Пункт ${label}`, en: `Item ${label}` },
    type: "bool",
    severity: "normal",
  };
}

async function createBlock(label: string): Promise<string> {
  const [row] = await db
    .insert(blocks)
    .values({
      title: { ru: `Блок ${label}`, en: `Block ${label}` },
      items: [libraryItem(label)],
    })
    .returning({ id: blocks.id });
  if (row === undefined) throw new Error("Блок библиотеки не вставился");
  return row.id;
}

async function setBlockItems(blockId: string, items: Item[]): Promise<void> {
  await db.update(blocks).set({ items }).where(eq(blocks.id, blockId));
}

/** Секция-ссылка: в черновике она хранит blockId, а пункты приходят из живого блока. */
function linkedSection(blockId: string): Section {
  return {
    id: "section-библиотека",
    title: { ru: "Холодильники", en: "Refrigerators" },
    source: { blockId },
    items: [],
  };
}

async function versionRow(id: string): Promise<Record<string, unknown>> {
  const result = await db.execute<{ row: Record<string, unknown> }>(
    sql`select to_jsonb(v) as row from checklist_versions v where v.id = ${id}`,
  );
  const row = result.rows[0]?.row;
  if (row === undefined) throw new Error(`Версии ${id} нет в базе`);
  return row;
}

async function sectionsOfVersion(id: string): Promise<Section[]> {
  const [row] = await db
    .select({ sections: checklistVersions.sections })
    .from(checklistVersions)
    .where(eq(checklistVersions.id, id));
  if (row === undefined) throw new Error(`Версии ${id} нет в базе`);
  return row.sections;
}

describe("publish", () => {
  test("«сохранить черновик» и «опубликовать» — разные действия: черновик остаётся черновиком", async () => {
    const checklistId = await newChecklist();
    await saveDraft(checklistId, sampleSections("рабочий"));

    const version = await publish(checklistId);

    expect(version.status).toBe("published");
    expect(version.versionNumber).toBe(1);
    // Черновик на месте и с той же разметкой: методист продолжает править дальше.
    const draft = await getDraft(checklistId);
    expect(draft?.status).toBe("draft");
    expect(draft?.sections).toStrictEqual(sampleSections("рабочий"));
  });

  test("следующая публикация даёт версию 2, а первая не меняется побайтово", async () => {
    const checklistId = await newChecklist();
    await saveDraft(checklistId, sampleSections("первая"));
    const first = await publish(checklistId);
    const before = await versionRow(first.id);

    await saveDraft(checklistId, sampleSections("вторая"));
    const second = await publish(checklistId);

    expect(second.versionNumber).toBe(2);
    const after = await versionRow(first.id);
    // Единственное законное изменение прежней версии — признак архивации.
    expect({ ...after, status: before["status"] }).toStrictEqual(before);
    expect(after["status"]).toBe("archived");
  });

  test("вставленный блок библиотеки разворачивается в снимок на момент публикации", async () => {
    const blockId = await createBlock("холодильники");
    const checklistId = await newChecklist();
    await saveDraft(checklistId, [linkedSection(blockId)]);

    const version = await publish(checklistId);

    const published = await sectionsOfVersion(version.id);
    expect(published[0]?.items).toStrictEqual([libraryItem("холодильники")]);
    // Происхождение секции сохраняется: библиотеке нужно знать, какие опубликованные
    // версии затронет правка блока, а пункты в версии — уже снимок, а не ссылка.
    expect(published[0]?.source).toStrictEqual({ blockId });
  });

  test("правка блока после публикации не меняет опубликованную версию, но приходит в черновик", async () => {
    // Ровно этого требует D002: версии неизменяемы, а библиотека остаётся живой.
    const blockId = await createBlock("санитария");
    const checklistId = await newChecklist();
    await saveDraft(checklistId, [linkedSection(blockId)]);
    const first = await publish(checklistId);
    const before = await versionRow(first.id);

    await setBlockItems(blockId, [libraryItem("санитария-2")]);

    expect(await versionRow(first.id)).toStrictEqual(before);
    // Черновик показывает уже новые пункты блока — иначе правка «в одном месте» не работает.
    const state = await loadEditor(checklistId);
    expect(state?.sections[0]?.items).toStrictEqual([
      libraryItem("санитария-2"),
    ]);

    // И следующая публикация уносит в версию именно новый снимок.
    const second = await publish(checklistId);
    expect((await sectionsOfVersion(second.id))[0]?.items).toStrictEqual([
      libraryItem("санитария-2"),
    ]);
  });

  test("публиковать нечего: у чек-листа нет ни одного пункта", async () => {
    // Пустой чек-лист на станции — это открытый по QR экран без единого пункта.
    const checklistId = await newChecklist();

    await expect(publish(checklistId)).rejects.toMatchObject({
      code: "nothingToPublish",
    });
  });

  test("несуществующий чек-лист — отказ с внятным кодом, а не ошибка драйвера", async () => {
    await expect(publish("не-опознаватель")).rejects.toMatchObject({
      code: "notFound",
    });
    await expect(
      publish("0f3a1f6e-6c1a-4c2e-9f2a-1f2b3c4d5e6f"),
    ).rejects.toMatchObject({ code: "notFound" });
  });
});
