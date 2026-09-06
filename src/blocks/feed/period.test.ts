import { describe, expect, it } from "vitest";

import { isFeedPeriod, relativeDay, resolvePeriod } from "./period";

const NOW = new Date("2026-09-05T12:00:00Z");

describe("resolvePeriod", () => {
  it("«сегодня» — это сутки целиком в поясе экрана, а не последние 24 часа", () => {
    const range = resolvePeriod("today", NOW, "Asia/Almaty");

    expect(range.from).toStrictEqual(new Date("2026-09-04T19:00:00Z"));
    expect(range.to).toStrictEqual(new Date("2026-09-05T18:59:59.999Z"));
  });

  it("верхняя граница включает последнюю миллисекунду суток: слой доступа сравнивает включительно", () => {
    const range = resolvePeriod("today", NOW, "UTC");

    expect(range.to).toStrictEqual(new Date("2026-09-05T23:59:59.999Z"));
  });

  it("«7 дней» — это сегодня и шесть предыдущих суток", () => {
    const range = resolvePeriod("week", NOW, "UTC");

    expect(range.from).toStrictEqual(new Date("2026-08-30T00:00:00Z"));
    expect(range.to).toStrictEqual(new Date("2026-09-05T23:59:59.999Z"));
  });

  it("«месяц» — это сегодня и 29 предыдущих суток", () => {
    const range = resolvePeriod("month", NOW, "UTC");

    expect(range.from).toStrictEqual(new Date("2026-08-07T00:00:00Z"));
    expect(range.to).toStrictEqual(new Date("2026-09-05T23:59:59.999Z"));
  });

  it("нижняя граница периода — начало суток в поясе экрана даже через переход времени", () => {
    // Неделя, попадающая на перевод часов в Берлине 29 марта 2026.
    const range = resolvePeriod(
      "week",
      new Date("2026-04-01T10:00:00Z"),
      "Europe/Berlin",
    );

    expect(range.from).toStrictEqual(new Date("2026-03-25T23:00:00Z"));
  });
});

describe("isFeedPeriod", () => {
  it("узнаёт три периода экрана", () => {
    expect(isFeedPeriod("today")).toBe(true);
    expect(isFeedPeriod("week")).toBe(true);
    expect(isFeedPeriod("month")).toBe(true);
  });

  it("отвергает всё остальное: период приходит из адреса, то есть от кого угодно", () => {
    expect(isFeedPeriod("year")).toBe(false);
    expect(isFeedPeriod("")).toBe(false);
    expect(isFeedPeriod(undefined)).toBe(false);
  });
});

describe("relativeDay", () => {
  const now = new Date("2026-09-05T12:00:00Z");

  it("сегодняшнее заполнение показывается одним временем, без даты", () => {
    expect(relativeDay(new Date("2026-09-05T09:12:00Z"), now, "UTC")).toBe(
      "today",
    );
  });

  it("вчерашнее — «вчера», а не голое время: иначе 21:40 читается как сегодняшнее", () => {
    expect(relativeDay(new Date("2026-09-04T21:40:00Z"), now, "UTC")).toBe(
      "yesterday",
    );
  });

  it("позавчерашнее и старше показывается датой", () => {
    expect(relativeDay(new Date("2026-09-03T21:40:00Z"), now, "UTC")).toBe(
      "older",
    );
  });

  it("сутки считаются в поясе пиццерии: 20:00 UTC в Алматы — это уже завтра", () => {
    // 4 сентября 20:00 UTC = 5 сентября 01:00 в Алматы, то есть «сегодня».
    expect(
      relativeDay(new Date("2026-09-04T20:00:00Z"), now, "Asia/Almaty"),
    ).toBe("today");
  });

  it("заполнение из будущего (часы сервера сдвинули) не ломает экран", () => {
    expect(relativeDay(new Date("2026-09-06T09:00:00Z"), now, "UTC")).toBe(
      "today",
    );
  });
});
