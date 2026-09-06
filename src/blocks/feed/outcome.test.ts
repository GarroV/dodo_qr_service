import { describe, expect, it } from "vitest";

import { outcomeOf } from "./outcome";

describe("outcomeOf", () => {
  it("всё отвечено и ничего не провалено — «всё выполнено»", () => {
    expect(
      outcomeOf({
        itemCount: 7,
        answeredCount: 7,
        failedCount: 0,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "ok" });
  });

  it("проваленный критичный пункт важнее остальных и показывается своим числом", () => {
    expect(
      outcomeOf({
        itemCount: 7,
        answeredCount: 7,
        failedCount: 3,
        failedCriticalCount: 1,
      }),
    ).toStrictEqual({ kind: "criticalFailed", count: 1 });
  });

  it("провал без критичных пунктов — предупреждение с числом проваленных", () => {
    expect(
      outcomeOf({
        itemCount: 7,
        answeredCount: 7,
        failedCount: 2,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "failed", count: 2 });
  });

  it("пункт без ответа не выдаётся за выполненный", () => {
    expect(
      outcomeOf({
        itemCount: 7,
        answeredCount: 5,
        failedCount: 0,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "unanswered", count: 2 });
  });

  it("провал важнее неотвеченного: разбираться идут с проваленного", () => {
    expect(
      outcomeOf({
        itemCount: 7,
        answeredCount: 5,
        failedCount: 1,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "failed", count: 1 });
  });

  it("пустой снимок — заполнять было нечего, но это не провал", () => {
    expect(
      outcomeOf({
        itemCount: 0,
        answeredCount: 0,
        failedCount: 0,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "ok" });
  });

  it("ответов больше, чем пунктов снимка, — неотвеченных нет, а не минус два", () => {
    expect(
      outcomeOf({
        itemCount: 3,
        answeredCount: 5,
        failedCount: 0,
        failedCriticalCount: 0,
      }),
    ).toStrictEqual({ kind: "ok" });
  });
});
