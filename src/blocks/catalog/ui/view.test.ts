// Состояние экрана приходит из адреса, то есть из рук кого угодно. Здесь проверяется
// граница: годное разбирается, негодное отбрасывается, и ни одна строка из адреса
// не доезжает до запроса как есть.
import { describe, expect, test } from "vitest";

import { catalogHref, parseCatalogView } from "./view";

const ID = "8f14e45f-ceea-467a-9c2b-3f2a1b7e0d11";
const OTHER_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("разбор адреса экрана", () => {
  test("годные значения доезжают", () => {
    expect(
      parseCatalogView({
        country: ID,
        store: OTHER_ID,
        focus: "store",
        create: "station",
        confirm: "store",
        error: "referencedByHistory",
      }),
    ).toStrictEqual({
      countryId: ID,
      storeId: OTHER_ID,
      stationId: undefined,
      focus: "store",
      create: "station",
      confirm: "store",
      error: "referencedByHistory",
    });
  });

  test("не-uuid в месте идентификатора отбрасывается", () => {
    // Иначе строка уехала бы в запрос и упала бы ошибкой драйвера 22P02 вместо экрана.
    const view = parseCatalogView({
      country: "'; drop table stores; --",
      store: "42",
      station: "",
    });

    expect(view.countryId).toBeUndefined();
    expect(view.storeId).toBeUndefined();
    expect(view.stationId).toBeUndefined();
  });

  test("неизвестные значения перечислимых параметров отбрасываются", () => {
    const view = parseCatalogView({
      focus: "секретно",
      create: "country ",
      confirm: "country",
      error: "нет такого кода",
    });

    expect(view.focus).toBeUndefined();
    expect(view.create).toBeUndefined();
    // confirm бывает только для пиццерии и станции: страна удаляется лишь пустой.
    expect(view.confirm).toBeUndefined();
    expect(view.error).toBeUndefined();
  });

  test("повторённый параметр берётся первым значением, а не склеивается", () => {
    expect(parseCatalogView({ country: [ID, OTHER_ID] }).countryId).toBe(ID);
  });

  test("пустой адрес — пустое состояние, а не падение", () => {
    expect(parseCatalogView({})).toStrictEqual({
      countryId: undefined,
      storeId: undefined,
      stationId: undefined,
      focus: undefined,
      create: undefined,
      confirm: undefined,
      error: undefined,
    });
  });
});

describe("сборка адреса экрана", () => {
  test("пустое состояние даёт чистый путь без вопросительного знака", () => {
    expect(catalogHref({})).toBe("/admin/catalog");
  });

  test("заданные значения попадают в адрес, пустые — нет", () => {
    expect(
      catalogHref({ countryId: ID, storeId: undefined, focus: "country" }),
    ).toBe(`/admin/catalog?country=${ID}&focus=country`);
  });

  test("адрес и разбор — обратимая пара", () => {
    const view = {
      countryId: ID,
      storeId: OTHER_ID,
      stationId: ID,
      focus: "station",
      create: "store",
      confirm: "station",
      error: "unknownTimezone",
    } as const;

    const parsed = parseCatalogView(
      Object.fromEntries(
        new URL(catalogHref(view), "http://localhost").searchParams,
      ),
    );

    expect(parsed).toStrictEqual({ ...view });
  });
});
