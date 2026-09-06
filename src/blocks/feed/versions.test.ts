// Дата публикации версии, по которой заполняли: карточка подписывает ею оговорку
// «показаны пункты в том виде, в котором их видел сотрудник».
import { afterAll, describe, expect, test } from "vitest";

import { closeTestDb } from "@/blocks/data/testing/db";
import {
  createChecklist,
  createDraft,
  createPublishedVersion,
  createStation,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { versionPublishedAt } from "./versions";

afterAll(closeTestDb);

describe("versionPublishedAt", () => {
  test("отдаёт время публикации версии", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("а"),
    );

    const publishedAt = await versionPublishedAt(versionId);

    expect(publishedAt).toBeInstanceOf(Date);
  });

  test("у черновика времени публикации нет — это null, а не отказ", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    const draftId = await createDraft(checklistId, sampleSections("б"));

    expect(await versionPublishedAt(draftId)).toBeNull();
  });

  test("неизвестная версия даёт null, а не исключение", async () => {
    expect(
      await versionPublishedAt("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });

  test("идентификатор не в формате uuid тоже даёт null: в базу такой запрос не уходит", async () => {
    expect(await versionPublishedAt("не-uuid")).toBeNull();
  });
});
