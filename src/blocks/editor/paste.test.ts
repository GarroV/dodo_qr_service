// Разбор вставленного из буфера списка (T021): методист копирует пункты из Word/Excel/
// заметок и вставляет одним действием, поэтому двадцать строк буфера обязаны стать
// двадцатью пунктами за один вызов, а не потеряться на маркерах и нумерации.
import { describe, expect, test } from "vitest";

import { parsePastedLines, parsePastedList } from "./paste";

describe("parsePastedLines", () => {
  test("список из Word: маркер «•\\t» и двойные пробелы внутри строки схлопываются", () => {
    const pasted =
      "•\tВключить печь и вытяжку\r\n•\tПроверить фритюр\r\n•\tПротереть  столы";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Включить печь и вытяжку",
      "Проверить фритюр",
      "Протереть столы",
    ]);
  });

  test("столбец из Excel: завершающий перевод строки не даёт лишний пункт", () => {
    const pasted = "Проверить фритюр\r\nПротереть столы\r\n";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Проверить фритюр",
      "Протереть столы",
    ]);
  });

  test("нумерованный список: точки, скобки и уровни вложенности отбрасываются", () => {
    const pasted =
      "1. Открыть смену\n2) Проверить кассу\n3.1. Сверить остатки\n(4) Проверить холодильник\n[5] Закрыть смену";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Открыть смену",
      "Проверить кассу",
      "Сверить остатки",
      "Проверить холодильник",
      "Закрыть смену",
    ]);
  });

  test("лишние пробелы и пустые строки между пунктами не мешают разбору", () => {
    const pasted = "  Пункт один  \n\n   \n\nПункт два\n";

    expect(parsePastedLines(pasted)).toStrictEqual(["Пункт один", "Пункт два"]);
  });

  test("смешанный список: часть строк с маркером, часть без", () => {
    const pasted = "- Пункт с маркером\nПункт без маркера\n* Ещё с маркером";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Пункт с маркером",
      "Пункт без маркера",
      "Ещё с маркером",
    ]);
  });

  test("двадцать строк дают ровно двадцать пунктов за один вызов", () => {
    const lines = Array.from(
      { length: 20 },
      (_, index) => `Пункт номер ${String(index + 1)}`,
    );

    const result = parsePastedLines(lines.join("\n"));

    expect(result).toHaveLength(20);
    expect(result).toStrictEqual(lines);
  });

  test("число без точки и скобки в начале строки — не нумерация, не режется", () => {
    const pasted = "5 кг теста\n2 пиццы в час";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "5 кг теста",
      "2 пиццы в час",
    ]);
  });

  test("чекбоксы Markdown «- [ ]» и «- [x]» дают чистый текст пункта", () => {
    const pasted = "- [ ] Помыть руки\n- [x] Надеть перчатки";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Помыть руки",
      "Надеть перчатки",
    ]);
  });

  test("пустой текст даёт пустой массив", () => {
    expect(parsePastedLines("")).toStrictEqual([]);
  });

  test("текст из одних пробелов и одиноких маркеров даёт пустой массив", () => {
    const pasted = "   \n-\n•\n\n \t \n1.";

    expect(parsePastedLines(pasted)).toStrictEqual([]);
  });

  test("одна строка без переводов строки даёт один пункт", () => {
    expect(parsePastedLines("Разморозить мясо")).toStrictEqual([
      "Разморозить мясо",
    ]);
  });

  test("поддерживает мягкий перенос Word и разделители \\u2028/\\u2029", () => {
    const pasted = "Пункт раз\vПункт два Пункт три Пункт четыре";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Пункт раз",
      "Пункт два",
      "Пункт три",
      "Пункт четыре",
    ]);
  });

  test("тире и дефисы внутри текста не трогаются", () => {
    const pasted = "Проверить чистоту — все поверхности";

    expect(parsePastedLines(pasted)).toStrictEqual([
      "Проверить чистоту — все поверхности",
    ]);
  });
  // Случаи добавлены при проверке работы исполнителя блок-агентом: дробное число
  // в начале строки, строка Excel из нескольких колонок и чекбокс без маркера списка.
  test("дробное число в начале строки нумерацией не считается", () => {
    expect(parsePastedLines("1.5 кг муки на замес")).toStrictEqual([
      "1.5 кг муки на замес",
    ]);
  });

  test("строка Excel из нескольких колонок склеивается в один пункт", () => {
    expect(parsePastedLines("Проверить фритюр\tответственный")).toStrictEqual([
      "Проверить фритюр ответственный",
    ]);
  });

  test("чекбокс Markdown без маркера списка тоже отбрасывается", () => {
    expect(parsePastedLines("[ ] Проверить пломбу")).toStrictEqual([
      "Проверить пломбу",
    ]);
  });
});

describe("parsePastedList", () => {
  test("строит пункт с типом bool и некритичным по умолчанию", () => {
    const [item] = parsePastedList("Включить печь", "ru");

    expect(item?.type).toBe("bool");
    expect(item?.critical).toBe(false);
    expect(item?.min).toBeUndefined();
    expect(item?.max).toBeUndefined();
    expect(item?.hint).toBeUndefined();
  });

  test("заголовок пишется под переданный язык «ru»", () => {
    const [item] = parsePastedList("Включить печь", "ru");

    expect(item?.title).toStrictEqual({ ru: "Включить печь" });
  });

  test("заголовок пишется под переданный язык «en»", () => {
    const [item] = parsePastedList("Turn on the oven", "en");

    expect(item?.title).toStrictEqual({ en: "Turn on the oven" });
  });

  test("у пунктов разные id", () => {
    const items = parsePastedList("Пункт один\nПункт два\nПункт три", "ru");

    const ids = new Set(items.map((item) => item.id));
    expect(ids.size).toBe(items.length);
  });

  test("пустой вставленный текст даёт пустой список пунктов", () => {
    expect(parsePastedList("   \n-\n", "ru")).toStrictEqual([]);
  });
});
