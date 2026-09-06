import { describe, expect, it } from "vitest";

import { zoneOffsetMs, zonedDayParts, zonedDayStart } from "./zone";

const HOUR = 3_600_000;

describe("zoneOffsetMs", () => {
  it("отдаёт ноль для UTC", () => {
    expect(zoneOffsetMs(new Date("2026-09-05T12:00:00Z"), "UTC")).toBe(0);
  });

  it("отдаёт смещение пиццерии: Алматы впереди UTC на пять часов", () => {
    expect(zoneOffsetMs(new Date("2026-09-05T12:00:00Z"), "Asia/Almaty")).toBe(
      5 * HOUR,
    );
  });

  it("отдаёт отрицательное смещение для поясов западнее Гринвича", () => {
    expect(
      zoneOffsetMs(new Date("2026-01-15T12:00:00Z"), "America/New_York"),
    ).toBe(-5 * HOUR);
  });

  it("учитывает переход на летнее время, а не берёт зимнее смещение круглый год", () => {
    const winter = zoneOffsetMs(
      new Date("2026-01-15T12:00:00Z"),
      "Europe/Berlin",
    );
    const summer = zoneOffsetMs(
      new Date("2026-07-15T12:00:00Z"),
      "Europe/Berlin",
    );
    expect(winter).toBe(HOUR);
    expect(summer).toBe(2 * HOUR);
  });
});

describe("zonedDayParts", () => {
  it("разбирает местную дату, а не дату сервера", () => {
    // 21:00 UTC — в Алматы уже следующее утро.
    expect(
      zonedDayParts(new Date("2026-09-05T21:00:00Z"), "Asia/Almaty"),
    ).toStrictEqual({ year: 2026, month: 9, day: 6 });
  });

  it("на западе от Гринвича день, наоборот, ещё вчерашний", () => {
    expect(
      zonedDayParts(new Date("2026-09-05T02:00:00Z"), "America/New_York"),
    ).toStrictEqual({ year: 2026, month: 9, day: 4 });
  });
});

describe("zonedDayStart", () => {
  it("начало суток в поясе пиццерии — это момент, а не полночь UTC", () => {
    expect(
      zonedDayStart(new Date("2026-09-05T12:00:00Z"), "Asia/Almaty"),
    ).toStrictEqual(new Date("2026-09-04T19:00:00Z"));
  });

  it("для UTC совпадает с полуночью UTC", () => {
    expect(
      zonedDayStart(new Date("2026-09-05T12:00:00Z"), "UTC"),
    ).toStrictEqual(new Date("2026-09-05T00:00:00Z"));
  });

  it("в день перехода на летнее время берёт смещение самой полуночи, а не полудня", () => {
    // 29 марта 2026 Берлин переводит часы в 02:00 (+01:00 → +02:00).
    // Сутки начинаются ещё по зимнему смещению: 28 марта 23:00 UTC.
    expect(
      zonedDayStart(new Date("2026-03-29T12:00:00Z"), "Europe/Berlin"),
    ).toStrictEqual(new Date("2026-03-28T23:00:00Z"));
  });

  it("в день возврата на зимнее время берёт летнее смещение полуночи", () => {
    // 25 октября 2026 Берлин возвращает часы в 03:00 (+02:00 → +01:00).
    expect(
      zonedDayStart(new Date("2026-10-25T12:00:00Z"), "Europe/Berlin"),
    ).toStrictEqual(new Date("2026-10-24T22:00:00Z"));
  });
});
