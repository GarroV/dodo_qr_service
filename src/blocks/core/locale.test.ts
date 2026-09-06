import { describe, expect, test } from "vitest";

import { DEFAULT_LOCALE, pickLocale } from "./locale";

describe("pickLocale", () => {
  test("возвращает русский на телефоне с русской локалью", () => {
    expect(pickLocale("ru-RU,ru;q=0.9,en-US;q=0.8")).toBe("ru");
  });

  test("возвращает английский на телефоне с английской локалью", () => {
    expect(pickLocale("en-US,en;q=0.9")).toBe("en");
  });

  test("учитывает вес q, а не порядок записи", () => {
    expect(pickLocale("de-DE,ru;q=0.9,en;q=0.4")).toBe("ru");
  });

  test("не различает регистр в коде языка", () => {
    expect(pickLocale("RU-ru")).toBe("ru");
  });

  test("падает на язык по умолчанию, когда ни один язык не поддержан", () => {
    expect(pickLocale("fr-FR,es;q=0.8")).toBe(DEFAULT_LOCALE);
  });

  test("падает на язык по умолчанию на пустом и отсутствующем заголовке", () => {
    expect(pickLocale("")).toBe(DEFAULT_LOCALE);
    expect(pickLocale(null)).toBe(DEFAULT_LOCALE);
    expect(pickLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  test("игнорирует мусорный вес и не падает на нём", () => {
    expect(pickLocale("ru;q=не-число")).toBe("ru");
  });

  test("на звёздочке отдаёт язык по умолчанию", () => {
    expect(pickLocale("*")).toBe(DEFAULT_LOCALE);
  });
});
