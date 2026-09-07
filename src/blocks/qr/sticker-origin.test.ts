import { describe, expect, it } from "vitest";

import { publicBasePath } from "./sticker-origin";

describe("базовый путь площадки", () => {
  it("пустой, когда переменная не задана: обычная площадка живёт на корне", () => {
    expect(publicBasePath({})).toBe("");
    expect(publicBasePath({ BASE_PATH: "" })).toBe("");
    expect(publicBasePath({ BASE_PATH: "   " })).toBe("");
  });

  it("приводит путь к одному виду: ведущая косая есть, замыкающей нет", () => {
    for (const raw of ["/qr", "qr", "/qr/", "  /qr  "]) {
      expect(publicBasePath({ BASE_PATH: raw })).toBe("/qr");
    }
  });

  it("отказывает на значении, которое уведёт наклейку в чужой адрес", () => {
    // Путь уезжает внутрь напечатанного кода: наклейка живёт годами (D006),
    // и ошибка в ней обнаруживается уже на стене.
    for (const raw of [
      "//evil.example",
      "/qr?x=1",
      "/qr#a",
      "https://evil.example/qr",
      "/пробел тут",
    ]) {
      expect(() => publicBasePath({ BASE_PATH: raw })).toThrow(/BASE_PATH/);
    }
  });
});
