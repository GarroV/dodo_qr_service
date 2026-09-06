// Сколько пунктов провалено в каждом заполнении. Слой доступа отдаёт только критичные
// (`failedCriticalCount`), а лента обязана отличать «всё выполнено» от «два пункта не
// выполнены»: заполнение с непройденным некритичным пунктом, названное успешным, —
// это ложь на главном экране управляющего.
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import type { Answer, Section } from "@/blocks/data";
import { checklistVersions, getDb, saveSubmission } from "@/blocks/data";
import { closeTestDb } from "@/blocks/data/testing/db";
import {
  createChecklist,
  createPublishedVersion,
  createStation,
} from "@/blocks/data/testing/fixtures";

import { loadFailedCounts } from "./failures";

afterAll(closeTestDb);

const SECTIONS: Section[] = [
  {
    id: "section-1",
    title: { ru: "Печь", en: "Oven" },
    source: "own",
    items: [
      {
        id: "item-critical",
        title: { ru: "Температура камеры", en: "Chamber temperature" },
        type: "number",
        critical: true,
        min: 2,
        max: 4,
      },
      {
        id: "item-plain",
        title: { ru: "Чистота поверхностей", en: "Surfaces clean" },
        type: "bool",
        critical: false,
      },
      {
        id: "item-text",
        title: { ru: "Что заметили", en: "Notes" },
        type: "text",
        critical: false,
      },
    ],
  },
];

function answer(itemId: string, value: boolean | number | string): Answer {
  return { itemId, value, at: Date.now() };
}

async function submit(answers: Answer[]): Promise<string> {
  const station = await createStation();
  const checklistId = await createChecklist({ stationId: station.stationId });
  const versionId = await createPublishedVersion(checklistId, SECTIONS);
  return saveSubmission({ versionId, answers, startedAt: Date.now() - 60_000 });
}

describe("loadFailedCounts", () => {
  test("считает и критичные, и обычные проваленные пункты", async () => {
    const id = await submit([
      answer("item-critical", 9),
      answer("item-plain", false),
      answer("item-text", "дверь скрипит"),
    ]);

    expect((await loadFailedCounts([id])).get(id)).toBe(2);
  });

  test("свободный текст провалить нельзя: это описание, а не оценка", async () => {
    const id = await submit([
      answer("item-critical", 3),
      answer("item-plain", true),
      answer("item-text", "нет"),
    ]);

    expect((await loadFailedCounts([id])).get(id)).toBe(0);
  });

  test("пункт без ответа не считается проваленным — он просто не отвечен", async () => {
    const id = await submit([answer("item-critical", 3)]);

    expect((await loadFailedCounts([id])).get(id)).toBe(0);
  });

  test("считает по снимку заполнения, а не по текущей версии чек-листа", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    const versionId = await createPublishedVersion(checklistId, SECTIONS);
    const id = await saveSubmission({
      versionId,
      answers: [answer("item-critical", 9), answer("item-plain", true)],
      startedAt: Date.now() - 60_000,
    });

    // Пункты той же версии переписаны мимо слоя доступа: снимок заполнения это
    // изменить не должно (принцип 3, D002).
    await getDb()
      .update(checklistVersions)
      .set({ sections: [] })
      .where(eq(checklistVersions.id, versionId));

    expect((await loadFailedCounts([id])).get(id)).toBe(1);
  });

  test("пустой список идентификаторов не идёт в базу и отдаёт пустую карту", async () => {
    expect(await loadFailedCounts([])).toStrictEqual(new Map());
  });

  test("неизвестный идентификатор просто отсутствует в карте", async () => {
    const counts = await loadFailedCounts([
      "00000000-0000-4000-8000-000000000000",
    ]);

    expect(counts.size).toBe(0);
  });
});
