// Приём выбора режима смены с публичной ссылки: разбор входа и границы.
// Тело действия вызывает кто угодно, а не только наш экран, — поэтому проверяется
// здесь, на границе, ровно как у отправки заполнения.
import { beforeEach, describe, expect, test } from "vitest";

import { forgetAllFillHits } from "./rate-limit";
import { parseShiftModeChoice } from "./shift-mode";

beforeEach(forgetAllFillHits);

const CODE = "ABCDEF";

describe("parseShiftModeChoice", () => {
  test("принимает выбор без сведений о людях", () => {
    const parsed = parseShiftModeChoice({ code: CODE, mode: "reduced" });

    expect(parsed).toStrictEqual({
      ok: true,
      value: {
        code: CODE,
        mode: "reduced",
        staffPresent: undefined,
        staffExpected: undefined,
      },
    });
  });

  test("принимает причину сокращения числами", () => {
    const parsed = parseShiftModeChoice({
      code: CODE,
      mode: "critical",
      staffPresent: 2,
      staffExpected: 4,
    });

    expect(parsed).toMatchObject({
      ok: true,
      value: { staffPresent: 2, staffExpected: 4 },
    });
  });

  test("числа приходят из формы строками и становятся числами", () => {
    const parsed = parseShiftModeChoice({
      code: CODE,
      mode: "reduced",
      staffPresent: "2",
      staffExpected: "4",
    });

    expect(parsed).toMatchObject({
      ok: true,
      value: { staffPresent: 2, staffExpected: 4 },
    });
  });

  test("неизвестный режим не проходит", () => {
    for (const mode of ["", "NORMAL", "major", "полная", null, 1]) {
      expect(parseShiftModeChoice({ code: CODE, mode })).toStrictEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  test("тело не той формы не проходит", () => {
    for (const input of [null, undefined, "reduced", 1, [], {}]) {
      expect(parseShiftModeChoice(input)).toStrictEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  test("заведомо негодный код до базы не доходит", () => {
    expect(
      parseShiftModeChoice({ code: "не код!", mode: "reduced" }),
    ).toStrictEqual({ ok: false, reason: "malformed" });
  });

  test("мусор в числах людей отбрасывается, а не роняет выбор", () => {
    // Причина сокращения необязательна: испорченное число не должно мешать
    // менеджеру поставить режим — иначе кухня встанет из-за подписи.
    const parsed = parseShiftModeChoice({
      code: CODE,
      mode: "reduced",
      staffPresent: "две",
      staffExpected: -7,
    });

    expect(parsed).toMatchObject({
      ok: true,
      value: { staffPresent: undefined, staffExpected: undefined },
    });
  });

  test("неправдоподобно большое число людей отбрасывается", () => {
    const parsed = parseShiftModeChoice({
      code: CODE,
      mode: "reduced",
      staffPresent: 100_000,
    });

    expect(parsed).toMatchObject({
      ok: true,
      value: { staffPresent: undefined },
    });
  });
});
