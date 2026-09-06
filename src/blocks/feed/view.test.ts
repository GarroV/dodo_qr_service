import { describe, expect, it } from "vitest";

import { feedHref, parseFeedView, submissionHref } from "./view";

const COUNTRY = "0d6fdf4e-1f16-4f3f-9f27-9b6f8b0a1c11";
const STORE = "3a2b7c1d-2e44-4b1a-8c5e-6f9d0a1b2c33";
const STATION = "9e8d7c6b-5a44-4321-9876-1a2b3c4d5e6f";

describe("parseFeedView", () => {
  it("пустой адрес — период «сегодня» и никаких фильтров", () => {
    expect(parseFeedView({})).toStrictEqual({ period: "today" });
  });

  it("разбирает все четыре фильтра сразу: они работают вместе, а не по одному", () => {
    expect(
      parseFeedView({
        country: COUNTRY,
        store: STORE,
        station: STATION,
        period: "week",
      }),
    ).toStrictEqual({
      countryId: COUNTRY,
      storeId: STORE,
      stationId: STATION,
      period: "week",
    });
  });

  it("значение не в формате uuid отбрасывается, а не уходит в запрос", () => {
    expect(
      parseFeedView({ country: "'; drop table submissions; --", store: STORE }),
    ).toStrictEqual({ storeId: STORE, period: "today" });
  });

  it("незнакомый период откатывается к «сегодня»", () => {
    expect(parseFeedView({ period: "century" })).toStrictEqual({
      period: "today",
    });
  });

  it("повторённый параметр берётся первым значением, а не склеивается", () => {
    expect(parseFeedView({ store: [STORE, STATION] })).toStrictEqual({
      storeId: STORE,
      period: "today",
    });
  });
});

describe("feedHref", () => {
  it("адрес без фильтров — сама лента", () => {
    expect(feedHref({ period: "today" })).toBe("/admin/feed");
  });

  it("период «сегодня» в адрес не попадает: это умолчание", () => {
    expect(feedHref({ countryId: COUNTRY, period: "today" })).toBe(
      `/admin/feed?country=${COUNTRY}`,
    );
  });

  it("собирает адрес со всеми фильтрами", () => {
    expect(
      feedHref({
        countryId: COUNTRY,
        storeId: STORE,
        stationId: STATION,
        period: "month",
      }),
    ).toBe(
      `/admin/feed?country=${COUNTRY}&store=${STORE}&station=${STATION}&period=month`,
    );
  });
});

describe("submissionHref", () => {
  it("карточка помнит фильтры ленты: возврат ведёт туда же, откуда пришли", () => {
    expect(
      submissionHref("11111111-2222-4333-8444-555555555555", {
        countryId: COUNTRY,
        storeId: null,
        stationId: null,
        period: "week",
      }),
    ).toBe(
      `/admin/feed/11111111-2222-4333-8444-555555555555?country=${COUNTRY}&period=week`,
    );
  });

  it("без фильтров адрес карточки остаётся коротким", () => {
    expect(
      submissionHref("11111111-2222-4333-8444-555555555555", {
        countryId: null,
        storeId: null,
        stationId: null,
        period: "today",
      }),
    ).toBe("/admin/feed/11111111-2222-4333-8444-555555555555");
  });
});
