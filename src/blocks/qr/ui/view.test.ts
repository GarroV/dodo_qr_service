import { describe, expect, it } from "vitest";

import {
  QR_CODE_PATH,
  QR_PATH,
  QR_SCREEN_PATH,
  parseQrView,
  parseStationRef,
  qrCodeHref,
  qrHref,
  qrScreenHref,
} from "./view";

const STORE = "11111111-2222-4333-8444-555555555555";
const STATION = "66666666-7777-4888-8999-aaaaaaaaaaaa";

describe("состояние экрана QR в адресе", () => {
  it("берёт пиццерию и станцию из адреса", () => {
    expect(parseQrView({ store: STORE, station: STATION })).toEqual({
      storeId: STORE,
      stationId: STATION,
    });
  });

  it("отбрасывает то, что не идентификатор: адрес правит кто угодно", () => {
    expect(
      parseQrView({ store: "'; drop table stations", station: "42" }),
    ).toEqual({});
  });

  it("из повторённого параметра берёт первое значение, а не склейку", () => {
    expect(parseQrView({ store: [STORE, STATION] }).storeId).toBe(STORE);
  });

  it("узнаёт свой код отказа и не пропускает ни выдуманный, ни чужой", () => {
    expect(parseQrView({ error: "notFound" }).error).toBe("notFound");
    expect(parseQrView({ error: "codeCollision" }).error).toBe("codeCollision");
    expect(parseQrView({ error: "какой-то" }).error).toBeUndefined();
    // Отказ справочника, которого перевыпуск не выдаёт: показывать его нечем.
    expect(parseQrView({ error: "unknownTimezone" }).error).toBeUndefined();
  });

  it("собирает адрес экрана: пустые значения в него не попадают", () => {
    expect(qrHref({})).toBe(QR_PATH);
    expect(qrHref({ storeId: STORE })).toBe(`${QR_PATH}?store=${STORE}`);
    expect(
      qrHref({ storeId: STORE, stationId: STATION, error: "notFound" }),
    ).toBe(`${QR_PATH}?store=${STORE}&station=${STATION}&error=notFound`);
  });

  it("адрес планшета и адрес опроса несут обе ссылки на станцию", () => {
    const ref = { storeId: STORE, stationId: STATION };

    expect(qrScreenHref(ref)).toBe(
      `${QR_SCREEN_PATH}?store=${STORE}&station=${STATION}`,
    );
    expect(qrCodeHref(ref)).toBe(
      `${QR_CODE_PATH}?store=${STORE}&station=${STATION}`,
    );
  });

  it("ссылку на станцию признаёт только целой: без пиццерии станцию не найти", () => {
    expect(parseStationRef({ store: STORE, station: STATION })).toEqual({
      storeId: STORE,
      stationId: STATION,
    });
    expect(parseStationRef({ store: STORE })).toBeNull();
    expect(parseStationRef({ station: STATION })).toBeNull();
    expect(parseStationRef({ store: "мусор", station: STATION })).toBeNull();
  });
});
