import { describe, expect, it } from "vitest";

import { STATION_SCAN_PREFIX, stationScanUrl } from "./scan-url";

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
