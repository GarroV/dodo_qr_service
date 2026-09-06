import { describe, expect, it } from "vitest";

import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("минуты и секунды через двоеточие, как на эталоне", () => {
    expect(formatDuration(204_000)).toBe("3:24");
  });

  it("секунды всегда двумя знаками", () => {
    expect(formatDuration(48_000)).toBe("0:48");
    expect(formatDuration(65_000)).toBe("1:05");
  });

  it("ноль — это 0:00, а не пустая строка", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("остаток миллисекунд отбрасывается вниз, а не округляется вверх", () => {
    expect(formatDuration(59_999)).toBe("0:59");
  });

  it("от часа и больше показывает часы: 61 минута — это 1:01:00, а не 61:00", () => {
    expect(formatDuration(3_660_000)).toBe("1:01:00");
    expect(formatDuration(3_661_000)).toBe("1:01:01");
  });

  it("отрицательная длительность невозможна, но не роняет экран", () => {
    expect(formatDuration(-5000)).toBe("0:00");
  });
});
