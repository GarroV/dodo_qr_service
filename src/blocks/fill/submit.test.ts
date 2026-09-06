import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Section } from "@/blocks/data";
import {
  checklistVersions,
  getDb,
  getSubmission,
  listSubmissions,
  publishVersion,
} from "@/blocks/data";
import {
  createChecklist,
  createDraft,
  createStation,
} from "@/blocks/data/testing/fixtures";

import { FILL_LIMITS, forgetAllFillHits } from "./rate-limit";
import { submitFilling } from "./submit";

const NOW = new Date("2026-09-06T09:30:00Z");
const STARTED_AT = NOW.getTime() - 3 * 60 * 1000;

function sectionsWith(label: string): Section[] {
  return [
    {
      id: `s-${label}`,
      title: { ru: "Печь", en: "Oven" },
      source: "own",
      items: [
        {
          id: `bool-${label}`,
          title: { ru: "Включить печь", en: "Turn on the oven" },
          type: "bool",
          critical: true,
        },
        {
          id: `num-${label}`,
          title: { ru: "Температура", en: "Temperature" },
          type: "number",
          critical: false,
          min: 2,
          max: 4,
        },
      ],
    },
  ];
}

interface Stand {
  code: string;
  checklistId: string;
  versionId: string;
  sections: Section[];
}

async function stand(label: string): Promise<Stand> {
  const station = await createStation();
  const checklistId = await createChecklist({
    stationId: station.stationId,
    windowStart: "06:00:00",
    windowEnd: "12:00:00",
  });
  const sections = sectionsWith(label);
  await createDraft(checklistId, sections);
  const version = await publishVersion(checklistId);
  return {
    code: station.stationCode,
    checklistId,
    versionId: version.id,
    sections,
  };
}

function fullAnswers(sections: Section[]): unknown[] {
  const items = sections[0]?.items ?? [];
  return [
    { itemId: items[0]?.id, value: true, at: STARTED_AT },
    { itemId: items[1]?.id, value: 3, at: STARTED_AT },
  ];
}

describe("отправка заполнения", () => {
  beforeEach(() => {
    forgetAllFillHits();
  });

  it("сохраняет заполнение и отвечает временем и длительностью с сервера", async () => {
    // Arrange
    const target = await stand("сохранение");

    // Act
    const outcome = await submitFilling(
      {
        code: target.code,
        versionId: target.versionId,
        startedAt: STARTED_AT,
        answers: fullAnswers(target.sections),
      },
      NOW,
    );

    // Assert
    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failedCritical).toBe(0);
    expect(outcome.durationMs).toBeGreaterThan(0);

    const [row] = await listSubmissions({ limit: 1 });
    expect(row?.versionId).toBe(target.versionId);
  });

  it("считает проваленные критичные пункты для экрана «отправлено»", async () => {
    const target = await stand("провал");
    const items = target.sections[0]?.items ?? [];

    const outcome = await submitFilling(
      {
        code: target.code,
        versionId: target.versionId,
        startedAt: STARTED_AT,
        answers: [
          {
            itemId: items[0]?.id,
            value: false,
            comment: "печь не греет, вызвал техника",
            at: STARTED_AT,
          },
          { itemId: items[1]?.id, value: 3, at: STARTED_AT },
        ],
      },
      NOW,
    );

    expect(outcome).toMatchObject({ kind: "saved", failedCritical: 1 });
  });
});

describe("гонка с публикацией новой версии", () => {
  beforeEach(() => {
    forgetAllFillHits();
  });

  it("пишет на ту версию, что была отдана клиенту, а не на свежую", async () => {
    // Arrange: сотрудник открыл экран и получил первую версию.
    const target = await stand("гонка");
    const given = target.versionId;
    const givenItems = target.sections[0]?.items ?? [];

    // Пока он заполнял, методист поменял черновик и опубликовал вторую версию.
    const nextSections = sectionsWith("новая");
    await getDb()
      .update(checklistVersions)
      .set({ sections: nextSections })
      .where(
        and(
          eq(checklistVersions.checklistId, target.checklistId),
          eq(checklistVersions.status, "draft"),
        ),
      );
    const published = await publishVersion(target.checklistId);
    expect(published.id).not.toBe(given);

    // Act: отправка уходит с тем идентификатором версии, что был на экране.
    const outcome = await submitFilling(
      {
        code: target.code,
        versionId: given,
        startedAt: STARTED_AT,
        answers: [
          { itemId: givenItems[0]?.id, value: true, at: STARTED_AT },
          { itemId: givenItems[1]?.id, value: 3, at: STARTED_AT },
        ],
      },
      NOW,
    );

    // Assert: запись легла на прежнюю версию, и снимок — её пункты, а не новые.
    expect(outcome.kind).toBe("saved");
    const [row] = await listSubmissions({ limit: 1 });
    expect(row?.versionId).toBe(given);

    const detail = await getSubmission(row?.id ?? "");
    expect(detail?.snapshot[0]?.items[0]?.id).toBe(givenItems[0]?.id);
    expect(detail?.snapshot[0]?.items[0]?.id).not.toBe(
      nextSections[0]?.items[0]?.id,
    );
  });
});

describe("защита публичной точки записи", () => {
  beforeEach(() => {
    forgetAllFillHits();
  });

  it("отбивает кривое тело запроса, не трогая базу", async () => {
    const outcome = await submitFilling({ мусор: true }, NOW);

    expect(outcome).toStrictEqual({
      kind: "refused",
      reason: "malformed",
      retryAfterSeconds: 0,
    });
  });

  it("неизвестный и перевыпущенный код получают один и тот же отказ", async () => {
    const target = await stand("отказ");

    const unknown = await submitFilling(
      {
        code: "zzzzzzzzzz",
        versionId: target.versionId,
        startedAt: STARTED_AT,
        answers: fullAnswers(target.sections),
      },
      NOW,
    );

    expect(unknown).toMatchObject({ kind: "refused", reason: "unknown-code" });
  });

  it("не даёт писать заполнение на версию чужой станции", async () => {
    // Один живой код с наклейки не должен открывать историю всей сети.
    const mine = await stand("своя");
    const other = await stand("чужая");

    const outcome = await submitFilling(
      {
        code: mine.code,
        versionId: other.versionId,
        startedAt: STARTED_AT,
        answers: fullAnswers(other.sections),
      },
      NOW,
    );

    expect(outcome).toMatchObject({ kind: "refused", reason: "unknown-code" });
  });

  it("не записывает проваленный критичный пункт без комментария", async () => {
    const target = await stand("без комментария");
    const items = target.sections[0]?.items ?? [];

    const outcome = await submitFilling(
      {
        code: target.code,
        versionId: target.versionId,
        startedAt: STARTED_AT,
        answers: [{ itemId: items[0]?.id, value: false, at: STARTED_AT }],
      },
      NOW,
    );

    expect(outcome).toMatchObject({
      kind: "refused",
      reason: "comment-required",
    });
  });

  it("отсекает поток отправок с одного кода и говорит, когда повторить", async () => {
    const target = await stand("поток");
    const body = {
      code: target.code,
      versionId: target.versionId,
      startedAt: STARTED_AT,
      answers: fullAnswers(target.sections),
    };
    for (let index = 0; index < FILL_LIMITS.submitPerCode.maxHits; index += 1) {
      expect((await submitFilling(body, NOW)).kind).toBe("saved");
    }

    const outcome = await submitFilling(body, NOW);

    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.reason).toBe("rate-limited");
    expect(outcome.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("перебор кодов не отдаёт ничего, кроме отказа", async () => {
    // Опора критерия готовности 8. В ответе на подобранный код не должно быть
    // ни намёка на то, есть ли такая станция, что на ней за чек-лист и была ли она.
    const target = await stand("перебор");

    const answers: unknown[] = [];
    for (let index = 0; index < 20; index += 1) {
      answers.push(
        await submitFilling(
          {
            code: `guess${String(index).padStart(5, "0")}`,
            versionId: target.versionId,
            startedAt: STARTED_AT,
            answers: fullAnswers(target.sections),
          },
          NOW,
        ),
      );
    }

    const serialized = JSON.stringify(answers);
    expect(serialized).not.toContain("Печь");
    expect(serialized).not.toContain("saved");
    expect(serialized).not.toContain(target.code);
    expect(serialized).not.toContain(target.versionId);
    for (const outcome of answers) {
      expect(Object.keys(outcome as object).sort()).toStrictEqual([
        "kind",
        "reason",
        "retryAfterSeconds",
      ]);
    }
  });
});
