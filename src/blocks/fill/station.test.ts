import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  checklistVersions,
  getDb,
  publishVersion,
  stations,
} from "@/blocks/data";
import {
  createChecklist,
  createDraft,
  createStation,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { findStationVersion, loadFillTarget } from "./station";

const MORNING = new Date("2026-09-06T09:00:00Z");
const AFTERNOON = new Date("2026-09-06T15:00:00Z");

async function publishedStation(): Promise<{
  code: string;
  stationId: string;
  versionId: string;
}> {
  const station = await createStation();
  const checklistId = await createChecklist({
    stationId: station.stationId,
    windowStart: "06:00:00",
    windowEnd: "12:00:00",
  });
  await createDraft(checklistId, sampleSections("опора"));
  const version = await publishVersion(checklistId);
  return {
    code: station.stationCode,
    stationId: station.stationId,
    versionId: version.id,
  };
}

describe("что отдаёт публичный маршрут по коду станции", () => {
  it("отдаёт опубликованную версию, название пиццерии и язык страны", async () => {
    // Arrange
    const { code, versionId } = await publishedStation();

    // Act
    const target = await loadFillTarget(code, MORNING);

    // Assert
    expect(target.kind).toBe("ok");
    if (target.kind !== "ok") return;
    expect(target.version.id).toBe(versionId);
    expect(target.storeName).toMatch(/^Пиццерия /);
    expect(target.stationName).toMatch(/^Станция /);
    expect(target.countryLocale).toBe("ru");
  });

  it("не отдаёт ничего сверх чек-листа: ни истории станции, ни других чек-листов", async () => {
    // Arrange: у той же станции есть заполнение и второй чек-лист на другое окно.
    const { code, stationId } = await publishedStation();
    const evening = await createChecklist({
      stationId,
      windowStart: "18:00:00",
      windowEnd: "23:00:00",
      title: { ru: "Вечерний", en: "Evening" },
    });
    await createDraft(evening, sampleSections("вечер"));
    await publishVersion(evening);

    // Act
    const target = await loadFillTarget(code, MORNING);

    // Assert: в ответе ровно один чек-лист и ни одного поля с историей.
    expect(target.kind).toBe("ok");
    const fields = Object.keys(target).sort();
    expect(fields).toStrictEqual([
      "checklist",
      "countryLocale",
      "kind",
      "stationName",
      "storeName",
      "version",
    ]);
    const serialized = JSON.stringify(target);
    expect(serialized).not.toContain("Вечерний");
    expect(serialized).not.toContain("submission");
  });

  it("неизвестный код даёт отказ, а не пустой экран и не чужой чек-лист", async () => {
    expect(await loadFillTarget("нетакогокода", MORNING)).toStrictEqual({
      kind: "unknown-code",
    });
  });

  it("перевыпущенный код неотличим от несуществующего", async () => {
    // Arrange: перевыпуск переписывает код станции — прежней строки нигде не остаётся,
    // поэтому старая наклейка обязана давать ровно тот же отказ, что и случайный код.
    const { code, stationId } = await publishedStation();
    await getDb()
      .update(stations)
      .set({ code: `re${code}`.slice(0, 10) })
      .where(eq(stations.id, stationId));

    expect(await loadFillTarget(code, MORNING)).toStrictEqual({
      kind: "unknown-code",
    });
  });

  it("код в чужом формате отбивается до похода в базу", async () => {
    expect(await loadFillTarget("", MORNING)).toStrictEqual({
      kind: "unknown-code",
    });
    expect(await loadFillTarget("a".repeat(500), MORNING)).toStrictEqual({
      kind: "unknown-code",
    });
    expect(await loadFillTarget("../../etc/passwd", MORNING)).toStrictEqual({
      kind: "unknown-code",
    });
  });

  it("живой код без подходящего чек-листа отличается от неизвестного кода", async () => {
    // Станция настоящая, но в 15:00 её утренний чек-лист закрыт: это другое состояние
    // экрана — «сейчас заполнять нечего», а не «наклейка не действует».
    const { code } = await publishedStation();

    expect(await loadFillTarget(code, AFTERNOON)).toStrictEqual({
      kind: "no-checklist",
    });
  });
});

describe("проверка версии на принадлежность станции", () => {
  it("отдаёт версию своей станции", async () => {
    const { code, versionId, stationId } = await publishedStation();

    const found = await findStationVersion(code, versionId);

    expect(found?.stationId).toBe(stationId);
    expect(found?.sections).toHaveLength(1);
  });

  it("отдаёт прежнюю версию той же станции: сотрудник заполнял её", async () => {
    // Опора T041: пока сотрудник заполнял, методист опубликовал следующую версию.
    const station = await createStation();
    const checklistId = await createChecklist({ stationId: station.stationId });
    await createDraft(checklistId, sampleSections("первая"));
    const first = await publishVersion(checklistId);
    // Черновик после публикации остаётся на месте — методист правит его дальше.
    await getDb()
      .update(checklistVersions)
      .set({ sections: sampleSections("вторая") })
      .where(
        and(
          eq(checklistVersions.checklistId, checklistId),
          eq(checklistVersions.status, "draft"),
        ),
      );
    await publishVersion(checklistId);

    const found = await findStationVersion(station.stationCode, first.id);

    expect(found?.versionId).toBe(first.id);
  });

  it("не отдаёт версию чужой станции", async () => {
    // Иначе кто угодно с одним живым кодом писал бы заполнения в историю любой станции сети.
    const mine = await publishedStation();
    const other = await publishedStation();

    expect(await findStationVersion(mine.code, other.versionId)).toBeNull();
  });

  it("не отдаёт черновик и мусор вместо идентификатора версии", async () => {
    const { code } = await publishedStation();

    expect(await findStationVersion(code, "не-uuid")).toBeNull();
    expect(
      await findStationVersion(code, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });
});
