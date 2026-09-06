import { describe, expect, it } from "vitest";

import {
  PUBLIC_BASE_URL_VAR,
  configuredOrigin,
  originFromHeaders,
  scanOrigin,
} from "./origin";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("публичный адрес из окружения", () => {
  it("берётся из переменной и попадает в ссылку как есть", () => {
    expect(
      configuredOrigin({
        [PUBLIC_BASE_URL_VAR]: "https://checklists.example.com",
      }),
    ).toBe("https://checklists.example.com");
  });

  it("сохраняет порт: наружу продукт смотрит одним свободным портом туннеля", () => {
    expect(
      configuredOrigin({
        [PUBLIC_BASE_URL_VAR]: "https://muspelheim.example:10000",
      }),
    ).toBe("https://muspelheim.example:10000");
  });

  it("отбрасывает путь и хвост: в ссылку идёт только источник", () => {
    expect(
      configuredOrigin({
        [PUBLIC_BASE_URL_VAR]: "https://example.com/admin/qr?x=1",
      }),
    ).toBe("https://example.com");
  });

  it("не задана — значения нет, и решает вызывающий", () => {
    expect(configuredOrigin({})).toBeNull();
    expect(configuredOrigin({ [PUBLIC_BASE_URL_VAR]: "  " })).toBeNull();
  });

  it("задана мусором — отказ, а не тихий возврат к localhost", () => {
    // Тихий возврат к умолчанию и есть та самая ловушка: коды печатаются рабочими
    // на вид и ведут в никуда со всей сети пиццерий.
    expect(() =>
      configuredOrigin({ [PUBLIC_BASE_URL_VAR]: "muspelheim:10000" }),
    ).toThrow(new RegExp(PUBLIC_BASE_URL_VAR));
  });
});

describe("источник ссылки, попадающей в наклейку", () => {
  it("переменная окружения сильнее адреса, по которому открыт продукт", () => {
    expect(
      scanOrigin(headers({ host: "localhost:3160" }), {
        [PUBLIC_BASE_URL_VAR]: "https://checklists.example.com",
      }),
    ).toBe("https://checklists.example.com");
  });

  it("без переменной остаётся адрес, по которому открыт сам продукт", () => {
    expect(scanOrigin(headers({ host: "localhost:3160" }), {})).toBe(
      "http://localhost:3160",
    );
  });

  it("берёт адрес, по которому открыт сам продукт", () => {
    expect(originFromHeaders(headers({ host: "localhost:3160" }))).toBe(
      "http://localhost:3160",
    );
  });

  it("за обратным проксированием слушает заголовки прокси", () => {
    expect(
      originFromHeaders(
        headers({
          host: "app.internal:3000",
          "x-forwarded-host": "checklists.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://checklists.example.com");
  });

  it("из цепочки прокси берёт первое звено — ближайшее к посетителю", () => {
    expect(
      originFromHeaders(
        headers({
          "x-forwarded-host": "checklists.example.com, app.internal",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://checklists.example.com");
  });

  it("отказывает, когда узла нет: наклейка без адреса бесполезна", () => {
    expect(() => originFromHeaders(headers({}))).toThrow(/узл|host/i);
  });

  it("отказывает на узле, из которого не собирается адрес", () => {
    expect(() => originFromHeaders(headers({ host: "a b" }))).toThrow(
      /узл|host/i,
    );
  });
});
