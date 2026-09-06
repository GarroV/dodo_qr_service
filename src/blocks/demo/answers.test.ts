import { describe, expect, test } from "vitest";

import type { Section } from "@/blocks/data";

import { answersFor } from "./answers";

const NOTE = "Quiet shift.";

const SECTIONS: Section[] = [
  {
    id: "s-1",
    title: { en: "Equipment" },
    source: "own",
    items: [
      { id: "i-oven", title: { en: "Oven on" }, type: "bool", critical: false },
      {
        id: "i-fryer",
        title: { en: "Fryer temperature" },
        type: "number",
        critical: true,
        min: 160,
        max: 180,
      },
      {
        id: "i-note",
        title: { en: "Shift note" },
        type: "text",
        critical: false,
      },
    ],
  },
  {
    id: "s-2",
    title: { en: "Safety" },
    source: { blockId: "b-1" },
    items: [
      { id: "i-labels", title: { en: "Labels" }, type: "bool", critical: true },
    ],
  },
];

describe("ответы демонстрационного заполнения", () => {
  test("отвечает на каждый пункт всех секций, включая вставленный блок", () => {
    const answers = answersFor(SECTIONS, { note: NOTE });

    expect(answers.map((answer) => answer.itemId)).toStrictEqual([
      "i-oven",
      "i-fryer",
      "i-note",
      "i-labels",
    ]);
  });

  test("по умолчанию всё в порядке: да, середина диапазона, ни одного комментария", () => {
    const answers = answersFor(SECTIONS, { note: NOTE });

    expect(answers[0]?.value).toBe(true);
    expect(answers[1]?.value).toBe(170);
    expect(answers[3]?.value).toBe(true);
    expect(answers.every((answer) => answer.comment === undefined)).toBe(true);
  });

  test("заметка попадает во все пункты свободного текста", () => {
    const answers = answersFor(SECTIONS, { note: NOTE });

    expect(answers[2]?.value).toBe(NOTE);
  });

  test("пункт свободного текста без заметки — ошибка, а не пустой ответ", () => {
    // Продукт такого ответа не создаёт вовсе: `isAnswered` в блоке fill считает текст
    // из одних пробелов НЕотвеченным пунктом. Пустая строка в демо выглядела бы как
    // «поле не сохранилось» — то есть как дефект продукта на самом показе.
    expect(() => answersFor(SECTIONS)).toThrow("i-note");
    expect(() => answersFor(SECTIONS, { note: "   " })).toThrow("i-note");
  });

  test("без пунктов свободного текста заметка не нужна", () => {
    const withoutText = SECTIONS.filter((section) =>
      section.items.every((item) => item.type !== "text"),
    );

    expect(answersFor(withoutText)).toHaveLength(1);
  });

  test("числа задаются по порядку числовых пунктов, а не по опознавателю", () => {
    const answers = answersFor(SECTIONS, { note: NOTE, numbers: [164] });

    expect(answers[1]?.value).toBe(164);
  });

  test("лишние числа не выдумывают пунктов, а недостающие берут середину диапазона", () => {
    const answers = answersFor(SECTIONS, { note: NOTE, numbers: [164, 999] });

    expect(answers).toHaveLength(4);
    expect(answers[1]?.value).toBe(164);
    expect(answersFor(SECTIONS, { note: NOTE, numbers: [] })[1]?.value).toBe(
      170,
    );
  });

  test("проваленный логический пункт отвечает «нет» и несёт комментарий", () => {
    const answers = answersFor(SECTIONS, {
      note: NOTE,
      failed: { itemId: "i-labels", comment: "Two sauces without labels." },
    });

    const failed = answers.find((answer) => answer.itemId === "i-labels");
    expect(failed?.value).toBe(false);
    expect(failed?.comment).toBe("Two sauces without labels.");
    // Остальные пункты провал не задевает.
    expect(answers[0]?.value).toBe(true);
  });

  test("проваленный числовой пункт выходит за нижнюю границу диапазона", () => {
    const answers = answersFor(SECTIONS, {
      note: NOTE,
      failed: {
        itemId: "i-fryer",
        comment: "Fryer did not reach temperature.",
      },
    });

    const failed = answers.find((answer) => answer.itemId === "i-fryer");
    expect(failed?.value).toBe(159);
    expect(failed?.comment).toBe("Fryer did not reach temperature.");
  });

  test("провал несуществующего пункта — ошибка, а не молча целое заполнение", () => {
    // Опечатка в опознавателе иначе дала бы «успешное» заполнение вместо показательного
    // провала, и дефект вылез бы только на показе.
    expect(() =>
      answersFor(SECTIONS, {
        note: NOTE,
        failed: { itemId: "i-nope", comment: "..." },
      }),
    ).toThrow("i-nope");
  });

  test("провалить пункт свободного текста нельзя: текст не оценивается", () => {
    expect(() =>
      answersFor(SECTIONS, {
        note: NOTE,
        failed: { itemId: "i-note", comment: "..." },
      }),
    ).toThrow("i-note");
  });
});
