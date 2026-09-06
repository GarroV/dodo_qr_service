// Сквозной путь «дублировать → опубликовать»: проверка блок-агентом работы исполнителя
// по T024 в связке с публикацией (T023). Тесты самой копии лежат в duplicate.test.ts;
// здесь то, чего в них нет: копия чек-листа, у которого есть и черновик, и опубликованная
// версия с заполнениями, и немедленная публикация копии на другую станцию.
import { eq, sql } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { checklistVersions } from "@/blocks/data";
import { closeTestDb, getTestDb } from "@/blocks/data/testing/db";
import { createStation, sampleSections } from "@/blocks/data/testing/fixtures";

import { createChecklist, saveDraft } from "./drafts";
import { duplicateChecklist } from "./duplicate";
import { publish } from "./publish";

const db = getTestDb();
afterAll(closeTestDb);

test("копия опубликованного чек-листа берёт черновик, не наследует заполнения и публикуется сама", async () => {
  const station = await createStation();
  const target = await createStation();
  const sourceId = await createChecklist({
    stationId: station.stationId,
    title: { ru: "Открытие кухни", en: "Kitchen opening" },
    window: { start: "20:00", end: "00:00" },
  });
  await saveDraft(sourceId, sampleSections("черновик"));
  await publish(sourceId);
  await saveDraft(sourceId, sampleSections("свежий-черновик"));

  const copyId = await duplicateChecklist(sourceId, {
    toStationId: target.stationId,
  });

  const copyVersions = await db
    .select()
    .from(checklistVersions)
    .where(eq(checklistVersions.checklistId, copyId));
  expect(copyVersions).toHaveLength(1);
  expect(copyVersions[0]?.status).toBe("draft");
  expect(copyVersions[0]?.versionNumber).toBeNull();
  // Разметка взята из черновика, а не из опубликованной версии.
  expect(copyVersions[0]?.sections[0]?.items[0]?.title).toStrictEqual(
    sampleSections("свежий-черновик")[0]?.items[0]?.title,
  );

  const copySubmissions = await db.execute<{ count: string }>(
    sql`select count(*) as count from submissions sub
        join checklist_versions v on v.id = sub.version_id
       where v.checklist_id = ${copyId}::uuid`,
  );
  expect(Number(copySubmissions.rows[0]?.count)).toBe(0);

  // Копию можно опубликовать сразу: она уходит на свою станцию своей версией 1.
  const published = await publish(copyId);
  expect(published.versionNumber).toBe(1);
  expect(published.stationId).toBe(target.stationId);
});
