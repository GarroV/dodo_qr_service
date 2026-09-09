// Дублирование чек-листа на настоящей базе: разметка копируется, история заполнений — нет.
// Правило «id пунктов и секций не переиспользуются между чек-листами» здесь смысловое,
// а не индексное — база двум разным чек-листам одинаковый id пункта не запрещает,
// поэтому и проверяется кодом, а не ограничением схемы.
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  checklistVersions,
  checklists,
  getDraft,
  saveSubmission,
  submissions,
} from "@/blocks/data";
import { closeTestDb, getTestDb } from "@/blocks/data/testing/db";
import {
  checklistStationId,
  createChecklist,
  createDraft,
  createPublishedVersion,
  createStation,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { duplicateChecklist } from "./duplicate";
import { EditorInputError } from "./validation";

const db = getTestDb();

afterAll(closeTestDb);

/** Секция со вставленным блоком библиотеки: `source` несёт ссылку, а не «own». */
function linkedSections(blockId: string): ReturnType<typeof sampleSections> {
  const [section] = sampleSections("блок");
  if (section === undefined) throw new Error("sampleSections пуст");
  return [{ ...section, source: { blockId } }];
}

async function versionsOf(checklistId: string): Promise<{ status: string }[]> {
  return db
    .select({ status: checklistVersions.status })
    .from(checklistVersions)
    .where(eq(checklistVersions.checklistId, checklistId));
}

async function submissionCountForVersion(versionId: string): Promise<number> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.versionId, versionId));
  return rows.length;
}

describe("duplicateChecklist", () => {
  test("копирует секции и пункты по содержанию, но с новыми id", async () => {
    const checklistId = await createChecklist();
    const original = sampleSections("исходный");
    await createDraft(checklistId, original);

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    expect(copyDraft?.sections).toHaveLength(1);
    const copySection = copyDraft?.sections[0];
    const originalSection = original[0];
    if (copySection === undefined || originalSection === undefined) {
      throw new Error("секция потерялась");
    }
    expect(copySection.id).not.toBe(originalSection.id);
    expect(copySection.title).toStrictEqual(originalSection.title);
    expect(copySection.source).toBe("own");

    expect(copySection.items).toHaveLength(1);
    const copyItem = copySection.items[0];
    const originalItem = originalSection.items[0];
    if (copyItem === undefined || originalItem === undefined) {
      throw new Error("пункт потерялся");
    }
    expect(copyItem.id).not.toBe(originalItem.id);
    expect(copyItem.title).toStrictEqual(originalItem.title);
    expect(copyItem.type).toBe(originalItem.type);
    expect(copyItem.severity).toBe(originalItem.severity);
  });

  test("сохраняет диапазон числового пункта", async () => {
    const checklistId = await createChecklist();
    await createDraft(checklistId, [
      {
        id: "section-range",
        title: { ru: "Температура" },
        source: "own",
        items: [
          {
            id: "item-range",
            title: { ru: "Градусы" },
            type: "number",
            critical: false,
            min: 2,
            max: 8,
          },
        ],
      },
    ]);

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    const item = copyDraft?.sections[0]?.items[0];
    expect(item?.min).toBe(2);
    expect(item?.max).toBe(8);
  });

  test("у копии ровно один черновик и ни одной опубликованной версии", async () => {
    const checklistId = await createChecklist();
    await createDraft(checklistId, sampleSections("исходный"));
    await createPublishedVersion(checklistId, sampleSections("исходный"), 1);

    const copyId = await duplicateChecklist(checklistId);

    const versions = await versionsOf(copyId);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.status).toBe("draft");
  });

  test("перенос на другую станцию: копия привязана к ней, исходный не тронут", async () => {
    const stationA = await createStation();
    const stationB = await createStation();
    const checklistId = await createChecklist({
      stationId: stationA.stationId,
    });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId, {
      toStationId: stationB.stationId,
    });

    expect(await checklistStationId(copyId)).toBe(stationB.stationId);
    expect(await checklistStationId(checklistId)).toBe(stationA.stationId);
  });

  test("toStationId не передан — копия остаётся на станции исходного", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId);

    expect(await checklistStationId(copyId)).toBe(station.stationId);
  });

  test("toStationId: null — копия без станции", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId, { toStationId: null });

    expect(await checklistStationId(copyId)).toBeNull();
    expect(await checklistStationId(checklistId)).toBe(station.stationId);
  });

  test("мусорная строка вместо toStationId — badFormat, а не ошибка драйвера", async () => {
    const checklistId = await createChecklist();
    await createDraft(checklistId, sampleSections("исходный"));

    await expect(
      duplicateChecklist(checklistId, { toStationId: "не-uuid" }),
    ).rejects.toMatchObject({ code: "badFormat" });
  });

  test("разметка берётся из черновика, если он есть", async () => {
    const checklistId = await createChecklist();
    await createDraft(checklistId, sampleSections("черновик"));
    await createPublishedVersion(
      checklistId,
      sampleSections("опубликованный"),
      1,
    );

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    expect(copyDraft?.sections[0]?.title).toStrictEqual(
      sampleSections("черновик")[0]?.title,
    );
  });

  test("черновика нет — разметка берётся из опубликованной версии", async () => {
    const checklistId = await createChecklist();
    await createPublishedVersion(
      checklistId,
      sampleSections("опубликованный"),
      1,
    );

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    expect(copyDraft?.sections[0]?.title).toStrictEqual(
      sampleSections("опубликованный")[0]?.title,
    );
  });

  test("ни черновика, ни версии — копия с пустой разметкой", async () => {
    const checklistId = await createChecklist();

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    expect(copyDraft?.sections).toStrictEqual([]);
  });

  test("история заполнений не копируется", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    await createDraft(checklistId, sampleSections("исходный"));
    const publishedId = await createPublishedVersion(
      checklistId,
      sampleSections("исходный"),
      1,
    );
    await saveSubmission({
      mode: "normal",
      versionId: publishedId,
      answers: [{ itemId: "item-исходный", value: true, at: Date.now() }],
      startedAt: Date.now(),
    });
    expect(await submissionCountForVersion(publishedId)).toBe(1);

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    if (copyDraft === null) throw new Error("у копии нет черновика");
    expect(await submissionCountForVersion(copyDraft.id)).toBe(0);
    // Заполнение исходного осталось на месте — ни строка, ни счётчик не тронуты.
    expect(await submissionCountForVersion(publishedId)).toBe(1);
  });

  test("секция-ссылка на блок библиотеки: source сохранён, id секции новый", async () => {
    const checklistId = await createChecklist();
    const blockId = "11111111-1111-1111-1111-111111111111";
    await createDraft(checklistId, linkedSections(blockId));

    const copyId = await duplicateChecklist(checklistId);

    const copyDraft = await getDraft(copyId);
    const section = copyDraft?.sections[0];
    expect(section?.source).toStrictEqual({ blockId });
    expect(section?.id).not.toBe(linkedSections(blockId)[0]?.id);
  });

  test("название по умолчанию получает суффикс на обоих языках", async () => {
    const checklistId = await createChecklist({
      title: { ru: "Открытие кухни", en: "Kitchen opening" },
    });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId);

    const [row] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, copyId));
    expect(row?.title).toStrictEqual({
      ru: "Открытие кухни (копия)",
      en: "Kitchen opening (copy)",
    });
  });

  test("явно переданное название берётся как есть", async () => {
    const checklistId = await createChecklist({ title: { ru: "Было" } });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId, {
      title: { ru: "Своё имя" },
    });

    const [row] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, copyId));
    expect(row?.title).toStrictEqual({ ru: "Своё имя" });
  });

  test("окно времени копируется: обычное", async () => {
    const checklistId = await createChecklist({
      windowStart: "06:00:00",
      windowEnd: "11:00:00",
    });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId);

    const [row] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, copyId));
    expect(row?.windowStart).toBe("06:00:00");
    expect(row?.windowEnd).toBe("11:00:00");
  });

  test("окно времени копируется: вечернее через полночь", async () => {
    const checklistId = await createChecklist({
      windowStart: "20:00:00",
      windowEnd: "00:00:00",
    });
    await createDraft(checklistId, sampleSections("исходный"));

    const copyId = await duplicateChecklist(checklistId);

    const [row] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, copyId));
    expect(row?.windowStart).toBe("20:00:00");
    expect(row?.windowEnd).toBe("00:00:00");
  });

  test("исходный чек-лист не меняется ничем", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Оригинал" },
    });
    await createDraft(checklistId, sampleSections("исходный"));

    await duplicateChecklist(checklistId, { toStationId: null });

    const [row] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, checklistId));
    expect(row?.title).toStrictEqual({ ru: "Оригинал" });
    expect(row?.stationId).toBe(station.stationId);
    const draft = await getDraft(checklistId);
    expect(draft?.sections).toStrictEqual(sampleSections("исходный"));
  });

  test("неизвестный id — notFound", async () => {
    await expect(
      duplicateChecklist("0f3a1f6e-6c1a-4c2e-9f2a-1f2b3c4d5e6f"),
    ).rejects.toMatchObject({ code: "notFound" });
  });

  test("мусорная строка вместо id — notFound, а не ошибка драйвера uuid", async () => {
    await expect(duplicateChecklist("не-uuid")).rejects.toMatchObject({
      code: "notFound",
    });
    await expect(duplicateChecklist("не-uuid")).rejects.toBeInstanceOf(
      EditorInputError,
    );
  });
});
