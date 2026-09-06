// Требования к содержимому демонстрационного контура. Тесты написаны до самих данных:
// они и есть контракт на состав (T049) и одновременно защита от тихой порчи —
// русская строка, дубль опознавателя или код станции не из алфавита наклейки
// ломают демо не в момент правки, а на показе.
import { describe, expect, test } from "vitest";

import { STATION_CODE_ALPHABET, STATION_CODE_LENGTH } from "@/blocks/catalog";
import type { Answer, Item, LocalizedText, Section } from "@/blocks/data";
import { countFailedCritical, flattenItems } from "@/blocks/data";

import { DEMO } from "./dataset";
import type { DemoChecklist, DemoVersion } from "./model";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CYRILLIC = /[Ѐ-ӿ]/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const EXPECTED_STORES = 2;
const EXPECTED_STATIONS = 5;
const EXPECTED_CHECKLISTS = 3;
const MIN_SUBMISSIONS = 10;
const MIN_SECTIONS_PER_CHECKLIST = 2;
const MIN_REUSE_CHECKLISTS = 2;

function publishedVersion(checklist: DemoChecklist): DemoVersion {
  const found = checklist.versions.find(
    (version) => version.status === "published",
  );
  if (found === undefined) {
    throw new Error(`У чек-листа ${checklist.id} нет опубликованной версии`);
  }
  return found;
}

function allVersions(): DemoVersion[] {
  return DEMO.checklists.flatMap((checklist) => [...checklist.versions]);
}

function allSections(): Section[] {
  return [
    ...DEMO.checklists.flatMap((checklist) => [
      ...checklist.draft.sections,
      ...checklist.versions.flatMap((version) => [...version.sections]),
    ]),
  ];
}

function allItems(): Item[] {
  return [
    ...flattenItems(allSections()),
    ...DEMO.blocks.flatMap((block) => [...block.items]),
  ];
}

/** Все человекочитаемые строки контура: имена справочника и тексты чек-листов. */
function allTexts(): string[] {
  const localized: LocalizedText[] = [
    ...allSections().map((section) => section.title),
    ...allItems().map((item) => item.title),
    ...allItems().flatMap((item) =>
      item.hint === undefined ? [] : [item.hint],
    ),
    ...DEMO.blocks.map((block) => block.title),
    ...DEMO.checklists.map((checklist) => checklist.title),
  ];
  return [
    DEMO.country.name,
    ...DEMO.stores.map((store) => store.name),
    ...DEMO.stations.map((station) => station.name),
    ...localized.flatMap((text) => Object.values(text)),
    ...DEMO.submissions.flatMap((submission) =>
      submission.answers.flatMap((answer) => [
        answer.comment ?? "",
        typeof answer.value === "string" ? answer.value : "",
      ]),
    ),
  ];
}

/** Все опознаватели строк базы: они и есть область, которую сид у себя чистит. */
function allRowIds(): string[] {
  return [
    DEMO.country.id,
    ...DEMO.stores.map((store) => store.id),
    ...DEMO.stations.map((station) => station.id),
    ...DEMO.blocks.map((block) => block.id),
    ...DEMO.checklists.map((checklist) => checklist.id),
    ...DEMO.checklists.map((checklist) => checklist.draft.id),
    ...allVersions().map((version) => version.id),
    ...DEMO.submissions.map((submission) => submission.id),
  ];
}

function withAnswerTime(answers: readonly Omit<Answer, "at">[]): Answer[] {
  return answers.map((answer) => ({ ...answer, at: 0 }));
}

describe("состав демонстрационного контура", () => {
  test("страна одна, отдельная и английская", () => {
    expect(DEMO.country.locale).toBe("en");
    expect(DEMO.country.name).not.toBe("");
  });

  test("две пиццерии и пять станций, каждая станция в своей пиццерии", () => {
    expect(DEMO.stores).toHaveLength(EXPECTED_STORES);
    expect(DEMO.stations).toHaveLength(EXPECTED_STATIONS);

    const storeIds = new Set(DEMO.stores.map((store) => store.id));
    for (const station of DEMO.stations) {
      expect(storeIds.has(station.storeId)).toBe(true);
    }
    // Обе пиццерии со станциями: пустая пиццерия в демо смотрится недоделкой.
    for (const store of DEMO.stores) {
      expect(
        DEMO.stations.some((station) => station.storeId === store.id),
      ).toBe(true);
    }
  });

  test("часовой пояс пиццерии настоящий: по нему окно сравнивается с местным временем", () => {
    for (const store of DEMO.stores) {
      expect(() =>
        new Intl.DateTimeFormat("en", { timeZone: store.timezone }).format(),
      ).not.toThrow();
    }
  });

  test("коды станций — из алфавита наклейки, нужной длины и неповторяющиеся", () => {
    for (const station of DEMO.stations) {
      expect(station.code).toHaveLength(STATION_CODE_LENGTH);
      for (const symbol of station.code) {
        expect(STATION_CODE_ALPHABET).toContain(symbol);
      }
    }
    const codes = DEMO.stations.map((station) => station.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("три чек-листа, у каждого черновик, одна опубликованная версия и не меньше двух секций", () => {
    expect(DEMO.checklists).toHaveLength(EXPECTED_CHECKLISTS);

    const stationIds = new Set(DEMO.stations.map((station) => station.id));
    for (const checklist of DEMO.checklists) {
      expect(stationIds.has(checklist.stationId)).toBe(true);
      expect(
        checklist.versions.filter((version) => version.status === "published"),
      ).toHaveLength(1);
      expect(checklist.draft.sections.length).toBeGreaterThanOrEqual(
        MIN_SECTIONS_PER_CHECKLIST,
      );
      expect(
        publishedVersion(checklist).sections.length,
      ).toBeGreaterThanOrEqual(MIN_SECTIONS_PER_CHECKLIST);
      expect(TIME_PATTERN.test(checklist.window.start)).toBe(true);
      expect(TIME_PATTERN.test(checklist.window.end)).toBe(true);
      // Равные границы запрещены проверкой базы `checklists_window_not_empty`.
      expect(checklist.window.start).not.toBe(checklist.window.end);
    }
  });

  test("номера версий одного чек-листа не повторяются, а архивная старше опубликованной", () => {
    for (const checklist of DEMO.checklists) {
      const numbers = checklist.versions.map(
        (version) => version.versionNumber,
      );
      expect(new Set(numbers).size).toBe(numbers.length);

      const published = publishedVersion(checklist);
      for (const version of checklist.versions) {
        if (version.status !== "archived") continue;
        expect(version.versionNumber).toBeLessThan(published.versionNumber);
        expect(version.publishedHoursAgo).toBeGreaterThan(
          published.publishedHoursAgo,
        );
      }
    }
  });

  test("у каждого чек-листа есть критичный пункт", () => {
    for (const checklist of DEMO.checklists) {
      const items = flattenItems([...publishedVersion(checklist).sections]);
      expect(items.some((item) => item.critical)).toBe(true);
    }
  });

  test("блок библиотеки заведён один раз и вставлен не меньше чем в два чек-листа", () => {
    expect(DEMO.blocks.length).toBeGreaterThan(0);

    for (const block of DEMO.blocks) {
      const usedIn = DEMO.checklists.filter((checklist) =>
        checklist.draft.sections.some(
          (section) =>
            typeof section.source !== "string" &&
            section.source.blockId === block.id,
        ),
      );
      expect(usedIn.length).toBeGreaterThanOrEqual(MIN_REUSE_CHECKLISTS);

      // В опубликованной версии от блока остаётся снимок его пунктов: правка блока
      // не имеет права менять уже опубликованное (D011, принцип 3).
      for (const checklist of usedIn) {
        const linked = publishedVersion(checklist).sections.find(
          (section) =>
            typeof section.source !== "string" &&
            section.source.blockId === block.id,
        );
        expect(linked).toBeDefined();
        expect(linked?.items.map((item) => item.id)).toStrictEqual(
          block.items.map((item) => item.id),
        );
      }
    }
  });

  test("хотя бы у одной станции чек-листы закрывают все сутки: демо открывается в любой час", () => {
    const covered = DEMO.stations.some((station) => {
      const windows = DEMO.checklists
        .filter((checklist) => checklist.stationId === station.id)
        .map((checklist) => checklist.window);
      const minutes = new Set<number>();
      for (const window of windows) {
        const start = toMinutes(window.start);
        const end = toMinutes(window.end);
        const length = start < end ? end - start : 24 * 60 - start + end;
        for (let offset = 0; offset < length; offset++) {
          minutes.add((start + offset) % (24 * 60));
        }
      }
      return minutes.size === 24 * 60;
    });
    expect(covered).toBe(true);
  });

  test("заполнений не меньше десятка, все ссылаются на опубликованные и архивные версии своей станции", () => {
    expect(DEMO.submissions.length).toBeGreaterThanOrEqual(MIN_SUBMISSIONS);

    const versionStation = new Map(
      DEMO.checklists.flatMap((checklist) =>
        checklist.versions.map(
          (version) => [version.id, checklist.stationId] as const,
        ),
      ),
    );
    for (const submission of DEMO.submissions) {
      expect(versionStation.get(submission.versionId)).toBe(
        submission.stationId,
      );
      expect(submission.durationMinutes).toBeGreaterThan(0);
      expect(submission.submittedHoursAgo).toBeGreaterThanOrEqual(0);
    }
  });

  test("ответы попадают в пункты своей версии и покрывают их целиком", () => {
    const sectionsByVersion = new Map(
      allVersions().map((version) => [version.id, [...version.sections]]),
    );
    for (const submission of DEMO.submissions) {
      const sections = sectionsByVersion.get(submission.versionId) ?? [];
      const itemIds = flattenItems(sections).map((item) => item.id);
      const answered = submission.answers.map((answer) => answer.itemId);

      expect(new Set(answered).size).toBe(answered.length);
      for (const itemId of answered) expect(itemIds).toContain(itemId);
      // Незаполненных пунктов в демо нет: лента показывала бы «отвечено 3 из 7»,
      // и это читалось бы как недоделка продукта, а не как замысел данных.
      expect([...answered].sort()).toStrictEqual([...itemIds].sort());
    }
  });

  test("ровно одно заполнение проваливает критичный пункт и объясняет это комментарием", () => {
    const sectionsByVersion = new Map(
      allVersions().map((version) => [version.id, [...version.sections]]),
    );

    const failing = DEMO.submissions.filter(
      (submission) =>
        countFailedCritical(
          sectionsByVersion.get(submission.versionId) ?? [],
          withAnswerTime(submission.answers),
        ) > 0,
    );
    expect(failing).toHaveLength(1);

    const [submission] = failing;
    const critical = new Set(
      flattenItems(sectionsByVersion.get(submission?.versionId ?? "") ?? [])
        .filter((item) => item.critical)
        .map((item) => item.id),
    );
    const failed = submission?.answers.filter(
      (answer) => critical.has(answer.itemId) && answer.value === false,
    );
    expect(failed?.length).toBe(1);
    expect((failed?.[0]?.comment ?? "").length).toBeGreaterThan(0);
  });

  test("числовые пункты заданы диапазоном, а ответы на них — числа", () => {
    const items = new Map(allItems().map((item) => [item.id, item]));
    for (const item of items.values()) {
      if (item.type !== "number") continue;
      expect(item.min).toBeDefined();
      expect(item.max).toBeDefined();
      expect(item.min ?? 0).toBeLessThan(item.max ?? 0);
    }
    for (const submission of DEMO.submissions) {
      for (const answer of submission.answers) {
        const item = items.get(answer.itemId);
        if (item === undefined) continue;
        if (item.type === "number") expect(typeof answer.value).toBe("number");
        if (item.type === "bool") expect(typeof answer.value).toBe("boolean");
        if (item.type === "text") expect(typeof answer.value).toBe("string");
      }
    }
  });

  test("опознаватели строк — настоящие uuid и ни один не повторяется", () => {
    const ids = allRowIds();
    for (const id of ids) expect(UUID_PATTERN.test(id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("опознаватели секций и пунктов внутри одной разметки не повторяются", () => {
    for (const sections of [
      ...DEMO.checklists.map((checklist) => [...checklist.draft.sections]),
      ...allVersions().map((version) => [...version.sections]),
    ]) {
      const sectionIds = sections.map((section) => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      const itemIds = flattenItems(sections).map((item) => item.id);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });

  test("демо говорит только по-английски: русских букв нет нигде", () => {
    for (const text of allTexts()) {
      expect(CYRILLIC.test(text)).toBe(false);
    }
  });

  test("все многоязычные тексты заведены на английском и непусты", () => {
    const localized: LocalizedText[] = [
      ...allSections().map((section) => section.title),
      ...allItems().map((item) => item.title),
      ...DEMO.blocks.map((block) => block.title),
      ...DEMO.checklists.map((checklist) => checklist.title),
    ];
    for (const text of localized) {
      expect(Object.keys(text)).toStrictEqual(["en"]);
      expect((text["en"] ?? "").trim()).not.toBe("");
    }
  });
});

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}
