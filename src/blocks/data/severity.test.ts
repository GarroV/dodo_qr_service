import { describe, expect, test } from "vitest";

import {
  isItemInMode,
  isSeverity,
  isShiftMode,
  requiresCommentOnFailure,
  sectionsForMode,
  severityOf,
} from "./severity";
import type { Item, Section } from "./types";

function item(overrides: Partial<Item> & { id: string }): Item {
  return { title: { ru: overrides.id }, type: "bool", ...overrides };
}

function section(id: string, items: Item[]): Section {
  return { id, title: { ru: id }, source: "own", items };
}

describe("severityOf", () => {
  test("возвращает уровень, заданный явно", () => {
    expect(severityOf(item({ id: "a", severity: "major" }))).toBe("major");
  });

  test("старый признак critical:true читается как критичный уровень", () => {
    expect(severityOf(item({ id: "a", critical: true }))).toBe("critical");
  });

  test("старый признак critical:false читается как обычный уровень", () => {
    expect(severityOf(item({ id: "a", critical: false }))).toBe("normal");
  });

  test("пункт без обоих признаков считается обычным", () => {
    expect(severityOf(item({ id: "a" }))).toBe("normal");
  });

  test("явный уровень сильнее старого признака", () => {
    expect(
      severityOf(item({ id: "a", critical: true, severity: "normal" })),
    ).toBe("normal");
  });
});

describe("isItemInMode", () => {
  test("обычная смена включает все три уровня", () => {
    for (const severity of ["critical", "major", "normal"] as const) {
      expect(isItemInMode(item({ id: severity, severity }), "normal")).toBe(
        true,
      );
    }
  });

  test("смена с ограничениями включает критичные и важные, но не обычные", () => {
    expect(
      isItemInMode(item({ id: "a", severity: "critical" }), "reduced"),
    ).toBe(true);
    expect(isItemInMode(item({ id: "b", severity: "major" }), "reduced")).toBe(
      true,
    );
    expect(isItemInMode(item({ id: "c", severity: "normal" }), "reduced")).toBe(
      false,
    );
  });

  test("критичная смена включает только критичные", () => {
    expect(
      isItemInMode(item({ id: "a", severity: "critical" }), "critical"),
    ).toBe(true);
    expect(isItemInMode(item({ id: "b", severity: "major" }), "critical")).toBe(
      false,
    );
    expect(
      isItemInMode(item({ id: "c", severity: "normal" }), "critical"),
    ).toBe(false);
  });

  test("пункт со старым признаком critical входит в критичную смену", () => {
    expect(isItemInMode(item({ id: "a", critical: true }), "critical")).toBe(
      true,
    );
  });
});

describe("sectionsForMode", () => {
  const sections: Section[] = [
    section("s1", [
      item({ id: "gas", severity: "critical" }),
      item({ id: "wipe", severity: "normal" }),
    ]),
    section("s2", [item({ id: "till", severity: "major" })]),
    section("s3", [item({ id: "plants", severity: "normal" })]),
  ];

  test("обычная смена оставляет всё как было", () => {
    expect(sectionsForMode(sections, "normal")).toEqual(sections);
  });

  test("смена с ограничениями убирает обычные пункты", () => {
    const result = sectionsForMode(sections, "reduced");
    expect(result.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(result[0]?.items.map((i) => i.id)).toEqual(["gas"]);
  });

  test("секция, из которой выпали все пункты, не остаётся пустой", () => {
    const result = sectionsForMode(sections, "critical");
    expect(result.map((s) => s.id)).toEqual(["s1"]);
    expect(result[0]?.items.map((i) => i.id)).toEqual(["gas"]);
  });

  test("режим, в котором не осталось ни одного пункта, даёт пустой список", () => {
    expect(
      sectionsForMode([section("s", [item({ id: "x" })])], "critical"),
    ).toEqual([]);
  });

  test("исходные секции не изменяются", () => {
    const before = structuredClone(sections);
    sectionsForMode(sections, "critical");
    expect(sections).toEqual(before);
  });
});

describe("isShiftMode", () => {
  test("узнаёт три режима продукта", () => {
    expect(isShiftMode("normal")).toBe(true);
    expect(isShiftMode("reduced")).toBe(true);
    expect(isShiftMode("critical")).toBe(true);
  });

  test("отвергает всё остальное", () => {
    for (const value of ["", "NORMAL", "major", null, undefined, 1, {}]) {
      expect(isShiftMode(value)).toBe(false);
    }
  });
});

describe("requiresCommentOnFailure", () => {
  test("критичный и важный пункты требуют объяснения провала", () => {
    expect(
      requiresCommentOnFailure(item({ id: "a", severity: "critical" })),
    ).toBe(true);
    expect(requiresCommentOnFailure(item({ id: "b", severity: "major" }))).toBe(
      true,
    );
  });

  test("обычный пункт объяснения не требует", () => {
    expect(
      requiresCommentOnFailure(item({ id: "c", severity: "normal" })),
    ).toBe(false);
  });

  test("старый критичный пункт по-прежнему требует объяснения", () => {
    expect(requiresCommentOnFailure(item({ id: "d", critical: true }))).toBe(
      true,
    );
  });
});

describe("isSeverity", () => {
  test("узнаёт три уровня продукта", () => {
    expect(isSeverity("critical")).toBe(true);
    expect(isSeverity("major")).toBe(true);
    expect(isSeverity("normal")).toBe(true);
  });

  test("отвергает всё остальное", () => {
    for (const value of ["", "reduced", "CRITICAL", null, undefined, 0, []]) {
      expect(isSeverity(value)).toBe(false);
    }
  });
});
