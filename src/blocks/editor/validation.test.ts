// Проверка того, что приходит из браузера. Редактор — единственное место продукта,
// где разметку чек-листа пишет человек, и приходит она JSON-ом из формы: без разбора
// на границе в базу уехало бы что угодно, вплоть до чужих полей внутри JSONB.
import { describe, expect, test } from "vitest";

import {
  EditorInputError,
  LIMITS,
  parseSections,
  parseWindow,
} from "./validation";

/** Минимальная годная секция: от неё тесты отклоняются по одному полю. */
function goodSection(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "section-1",
    title: { ru: "Печь и оборудование", en: "Oven and equipment" },
    source: "own",
    items: [
      {
        id: "item-1",
        title: { ru: "Включить печь", en: "Turn on the oven" },
        type: "bool",
        critical: false,
      },
    ],
    ...overrides,
  };
}

describe("parseSections", () => {
  test("пропускает годную разметку без изменений", () => {
    const sections = parseSections([goodSection()]);

    expect(sections).toStrictEqual([
      {
        id: "section-1",
        title: { ru: "Печь и оборудование", en: "Oven and equipment" },
        source: "own",
        items: [
          {
            id: "item-1",
            title: { ru: "Включить печь", en: "Turn on the oven" },
            type: "bool",
            critical: false,
          },
        ],
      },
    ]);
  });

  test("отбрасывает поля, которых нет в контракте с блоком fill", () => {
    // Контракт sections — единственное, что читает экран заполнения. Лишнее поле,
    // доехавшее до JSONB, живёт там вечно и однажды будет прочитано как значащее.
    const sections = parseSections([
      goodSection({
        colour: "красный",
        items: [
          {
            id: "item-1",
            title: { ru: "Включить печь" },
            type: "bool",
            critical: false,
            secret: "шпион",
          },
        ],
      }),
    ]);

    expect(sections[0]).not.toHaveProperty("colour");
    expect(sections[0]?.items[0]).not.toHaveProperty("secret");
  });

  test("оставляет только языки продукта", () => {
    const sections = parseSections([
      goodSection({ title: { ru: "Печь", en: "Oven", de: "Ofen" } }),
    ]);

    expect(sections[0]?.title).toStrictEqual({ ru: "Печь", en: "Oven" });
  });

  test("пункт без названия отбрасывается, а не роняет сохранение", () => {
    // Пустая строка внизу списка — обычное состояние редактора: методист нажал Enter
    // и ещё не напечатал текст. Сохранение по кнопке не должно на ней спотыкаться.
    const sections = parseSections([
      goodSection({
        items: [
          {
            id: "item-1",
            title: { ru: "Включить печь" },
            type: "bool",
            critical: false,
          },
          { id: "item-2", title: { ru: "  " }, type: "bool", critical: false },
        ],
      }),
    ]);

    expect(sections[0]?.items.map((item) => item.id)).toStrictEqual(["item-1"]);
  });

  test("секция без пунктов сохраняется: её только что завели", () => {
    const sections = parseSections([goodSection({ items: [] })]);

    expect(sections[0]?.items).toStrictEqual([]);
  });

  test("ссылка на блок библиотеки сохраняется как ссылка", () => {
    const sections = parseSections([
      goodSection({
        source: { blockId: "0f3a1f6e-6c1a-4c2e-9f2a-1f2b3c4d5e6f" },
      }),
    ]);

    expect(sections[0]?.source).toStrictEqual({
      blockId: "0f3a1f6e-6c1a-4c2e-9f2a-1f2b3c4d5e6f",
    });
  });

  test("границы числового пункта приходят строками из формы и становятся числами", () => {
    const sections = parseSections([
      goodSection({
        items: [
          {
            id: "item-1",
            title: { ru: "Температура фритюра" },
            type: "number",
            critical: true,
            min: "160",
            max: "180",
          },
        ],
      }),
    ]);

    expect(sections[0]?.items[0]).toMatchObject({
      type: "number",
      critical: true,
      min: 160,
      max: 180,
    });
  });

  test("пустые границы числового пункта означают «без границы»", () => {
    const sections = parseSections([
      goodSection({
        items: [
          {
            id: "item-1",
            title: { ru: "Температура фритюра" },
            type: "number",
            critical: false,
            min: "",
            max: "",
          },
        ],
      }),
    ]);

    expect(sections[0]?.items[0]).not.toHaveProperty("min");
    expect(sections[0]?.items[0]).not.toHaveProperty("max");
  });

  test("нижняя граница выше верхней отвергается", () => {
    expect(() =>
      parseSections([
        goodSection({
          items: [
            {
              id: "item-1",
              title: { ru: "Температура" },
              type: "number",
              critical: false,
              min: 180,
              max: 160,
            },
          ],
        }),
      ]),
    ).toThrow(
      expect.objectContaining({ code: "badRange" }) as unknown,
    );
  });

  test("неизвестный тип ответа отвергается", () => {
    expect(() =>
      parseSections([
        goodSection({
          items: [
            {
              id: "item-1",
              title: { ru: "Пункт" },
              type: "подпись",
              critical: false,
            },
          ],
        }),
      ]),
    ).toThrow(EditorInputError);
  });

  test("не массив — отказ, а не пустой чек-лист", () => {
    // Молча превратить мусор в пустой список значит стереть чек-лист методисту.
    expect(() => parseSections({ sections: [] })).toThrow(
      expect.objectContaining({ code: "badFormat" }) as unknown,
    );
    expect(() => parseSections(null)).toThrow(EditorInputError);
    expect(() => parseSections("[]")).toThrow(EditorInputError);
  });

  test("слишком длинный текст отвергается", () => {
    expect(() =>
      parseSections([
        goodSection({ title: { ru: "я".repeat(LIMITS.textLength + 1) } }),
      ]),
    ).toThrow(
      expect.objectContaining({ code: "textTooLong" }) as unknown,
    );
  });

  test("больше пунктов, чем помещается в чек-лист, — отказ с внятным кодом", () => {
    // Верхняя граница размера JSONB стоит в базе; до неё отказ должен прийти отсюда,
    // иначе методист увидит ошибку драйвера вместо объяснения.
    const items = Array.from(
      { length: LIMITS.items + 1 },
      (_unused, index) => ({
        id: `item-${String(index)}`,
        title: { ru: `Пункт ${String(index)}` },
        type: "bool",
        critical: false,
      }),
    );

    expect(() => parseSections([goodSection({ items })])).toThrow(
      expect.objectContaining({ code: "tooManyItems" }) as unknown,
    );
  });

  test("больше секций, чем разрешено, — отказ", () => {
    const sections = Array.from(
      { length: LIMITS.sections + 1 },
      (_unused, index) => goodSection({ id: `section-${String(index)}` }),
    );

    expect(() => parseSections(sections)).toThrow(
      expect.objectContaining({ code: "tooManySections" }) as unknown,
    );
  });
});

describe("parseWindow", () => {
  test("время из формы дополняется секундами", () => {
    expect(parseWindow("06:00", "11:00")).toStrictEqual({
      start: "06:00:00",
      end: "11:00:00",
    });
  });

  test("окно через полночь — обычное вечернее окно, а не ошибка", () => {
    expect(parseWindow("20:00", "00:00")).toStrictEqual({
      start: "20:00:00",
      end: "00:00:00",
    });
  });

  test("«без ограничения» — это сутки целиком", () => {
    // 24:00 — законное значение time в PostgreSQL, и оно делает условие выбора версии
    // истинным в любую минуту. Равные границы для этого не годятся: их запрещает база.
    expect(parseWindow("00:00", "24:00")).toStrictEqual({
      start: "00:00:00",
      end: "24:00:00",
    });
  });

  test("равные границы отвергаются до базы", () => {
    expect(() => parseWindow("08:00", "08:00")).toThrow(
      expect.objectContaining({ code: "emptyWindow" }) as unknown,
    );
  });

  test("не время — отказ", () => {
    expect(() => parseWindow("утром", "11:00")).toThrow(EditorInputError);
    expect(() => parseWindow("25:00", "11:00")).toThrow(EditorInputError);
    expect(() => parseWindow("06:60", "11:00")).toThrow(EditorInputError);
  });
});
