import { describe, expect, test } from "vitest";

import { countFailedCritical, flattenItems, isFailed } from "./grading";
import type { Answer, Item, Section } from "./types";

function item(overrides: Partial<Item> & Pick<Item, "id" | "type">): Item {
  return {
    title: { ru: "Пункт", en: "Item" },
    critical: false,
    ...overrides,
  };
}

function answer(itemId: string, value: Answer["value"]): Answer {
  return { itemId, value, at: 1_700_000_000_000 };
}

describe("isFailed", () => {
  test("да/нет: ответ «нет» — провал", () => {
    expect(isFailed(item({ id: "a", type: "bool" }), answer("a", false))).toBe(
      true,
    );
  });

  test("да/нет: ответ «да» — не провал", () => {
    expect(isFailed(item({ id: "a", type: "bool" }), answer("a", true))).toBe(
      false,
    );
  });

  test("число ниже минимума — провал", () => {
    const temperature = item({ id: "t", type: "number", min: 2, max: 6 });
    expect(isFailed(temperature, answer("t", 1))).toBe(true);
  });

  test("число выше максимума — провал", () => {
    const temperature = item({ id: "t", type: "number", min: 2, max: 6 });
    expect(isFailed(temperature, answer("t", 7))).toBe(true);
  });

  test("число внутри диапазона — не провал", () => {
    const temperature = item({ id: "t", type: "number", min: 2, max: 6 });
    expect(isFailed(temperature, answer("t", 4))).toBe(false);
  });

  test("число без заданного диапазона провалить нельзя", () => {
    expect(isFailed(item({ id: "t", type: "number" }), answer("t", -100))).toBe(
      false,
    );
  });

  test("свободный текст не оценивается", () => {
    expect(isFailed(item({ id: "c", type: "text" }), answer("c", ""))).toBe(
      false,
    );
  });

  test("пункт без ответа не провален — он не отвечен", () => {
    expect(isFailed(item({ id: "a", type: "bool" }), undefined)).toBe(false);
  });
});

describe("countFailedCritical", () => {
  const snapshot: Section[] = [
    {
      id: "s1",
      title: { ru: "Открытие", en: "Opening" },
      source: "own",
      items: [
        item({ id: "crit-1", type: "bool", critical: true }),
        item({ id: "plain", type: "bool" }),
      ],
    },
    {
      id: "s2",
      title: { ru: "Оборудование", en: "Equipment" },
      source: { blockId: "block-1" },
      items: [item({ id: "crit-2", type: "number", critical: true, max: 6 })],
    },
  ];

  test("считает только критичные провалы", () => {
    const answers = [
      answer("crit-1", false),
      answer("plain", false),
      answer("crit-2", 4),
    ];

    expect(countFailedCritical(snapshot, answers)).toBe(1);
  });

  test("считает провалы во всех секциях, включая вставленный блок", () => {
    const answers = [answer("crit-1", false), answer("crit-2", 9)];

    expect(countFailedCritical(snapshot, answers)).toBe(2);
  });

  test("без ответов провалов нет", () => {
    expect(countFailedCritical(snapshot, [])).toBe(0);
  });
});

describe("flattenItems", () => {
  test("собирает пункты всех секций по порядку", () => {
    const sections: Section[] = [
      {
        id: "s1",
        title: { ru: "Раз", en: "One" },
        source: "own",
        items: [item({ id: "a", type: "bool" })],
      },
      {
        id: "s2",
        title: { ru: "Два", en: "Two" },
        source: "own",
        items: [item({ id: "b", type: "text" })],
      },
    ];

    expect(flattenItems(sections).map((each) => each.id)).toStrictEqual([
      "a",
      "b",
    ]);
  });
});
