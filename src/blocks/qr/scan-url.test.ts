import { describe, expect, it } from "vitest";

import { STATION_SCAN_PREFIX, stationScanUrl } from "./scan-url";
import { PUBLIC_BASE_URL_VAR } from "./sticker-origin";

describe("ссылка станции для QR", () => {
  it("собирает публичный адрес заполнения из источника и кода", () => {
    expect(stationScanUrl("https://checklists.example.com", "k7m2xqvpht")).toBe(
      "https://checklists.example.com/s/k7m2xqvpht",
    );
  });

  it("не сдваивает косую черту, когда источник записан с ней на конце", () => {
    expect(stationScanUrl("http://localhost:3160/", "k7m2xqvpht")).toBe(
      "http://localhost:3160/s/k7m2xqvpht",
    );
  });

  it("экранирует знаки, которые в адресе значили бы другое", () => {
    // Настоящий код такого не содержит, но ссылка обязана оставаться одной ссылкой,
    // а не превращаться в адрес с параметром или обрубок до решётки.
    expect(stationScanUrl("https://example.com", "a b#c?d")).toBe(
      "https://example.com/s/a%20b%23c%3Fd",
    );
  });

  it("отказывает на источнике, который не адрес", () => {
    expect(() => stationScanUrl("не адрес", "k7m2xqvpht")).toThrow(
      /источник ссылки/i,
    );
  });

  it("отказывает на пустом коде: ссылка в никуда хуже отсутствия наклейки", () => {
    expect(() => stationScanUrl("https://example.com", "")).toThrow(/код/i);
  });

  it("держит префикс публичного маршрута в одном месте", () => {
    expect(STATION_SCAN_PREFIX).toBe("/s/");
  });
});

describe("ссылка станции: что считается пригодным источником", () => {
  const CODE = "k7m2xqvpht";

  it("берёт только http и https: остальные схемы дают «null» вместо адреса", () => {
    // `new URL` глотает такие строки молча, а источник у них — «null»: наклейка
    // с адресом `null/s/<код>` печатается один раз и живёт годами.
    for (const origin of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "foo://bar",
      "mailto:kitchen@example.com",
    ]) {
      // Отказ называет причину: администратор площадки ищет свою опечатку
      // по тексту в журнале, а не по исходникам продукта.
      expect(() => stationScanUrl(origin, CODE)).toThrow(
        new RegExp(`${PUBLIC_BASE_URL_VAR}.*— схема не http`),
      );
    }
  });

  it("отказывает на источнике с учётными данными", () => {
    // `http://логин:пароль@узел` тихо превращается в `http://узел`: адрес наклейки
    // не совпал бы с тем, что задал администратор, и заметить это было бы негде.
    expect(() => stationScanUrl("http://user:pass@example.com", CODE)).toThrow(
      new RegExp(PUBLIC_BASE_URL_VAR),
    );
  });

  it("не пересказывает негодное значение в тексте отказа", () => {
    let message = "";
    try {
      stationScanUrl('"><script>alert(1)</script>', CODE);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(new RegExp(PUBLIC_BASE_URL_VAR));
    expect(message).not.toMatch(/[<>"&]/);
  });

  it("оставляет пригодные адреса пригодными", () => {
    expect(stationScanUrl("HTTPS://Example.COM", CODE)).toBe(
      `https://example.com/s/${CODE}`,
    );
    expect(stationScanUrl("http://localhost:3160", CODE)).toBe(
      `http://localhost:3160/s/${CODE}`,
    );
    expect(stationScanUrl("https://qr.example:10000/admin?x=1", CODE)).toBe(
      `https://qr.example:10000/s/${CODE}`,
    );
  });
  it("несёт базовый путь площадки, когда продукт опубликован не на корне", () => {
    // Иначе камера уходит на корень адреса, где у площадки живёт соседний сервис,
    // и наклейка ведёт в чужой продукт вместо заполнения (D045).
    expect(
      stationScanUrl("https://muspelheim.example:10000", "dmcskt2394", "/qr"),
    ).toBe("https://muspelheim.example:10000/qr/s/dmcskt2394");
  });

  it("без базового пути ссылка остаётся прежней", () => {
    expect(stationScanUrl("https://qr.example", "abc", "")).toBe(
      "https://qr.example/s/abc",
    );
  });
});
