import { describe, expect, it } from "vitest";

import { checkStartupConfig } from "./startup-checks";

describe("проверка окружения при старте", () => {
  it("не даёт продукту подняться с негодным PUBLIC_BASE_URL", () => {
    // Иначе негодное значение всплывает не при старте, а на экране печати —
    // у методиста, который просто открыл раздел QR.
    for (const value of ["javascript:alert(1)", "не адрес", "foo://bar"]) {
      expect(() => checkStartupConfig({ PUBLIC_BASE_URL: value })).toThrow(
        /PUBLIC_BASE_URL/,
      );
    }
  });

  it("пускает пустое окружение: свежий клон поднимается без .env", () => {
    expect(() => checkStartupConfig({})).not.toThrow();
  });

  it("пускает пригодный адрес площадки", () => {
    expect(() =>
      checkStartupConfig({ PUBLIC_BASE_URL: "https://qr.example:10000" }),
    ).not.toThrow();
  });

  it("говорит вслух, что предел на открытие экрана не применяется", () => {
    // Молча выключенный предел неотличим от работающего — отсюда строка в журнале.
    expect(checkStartupConfig({}).join(" · ")).toMatch(/TRUSTED_PROXY_HOPS/);
  });

  it("молчит про предел, когда посредник объявлен", () => {
    expect(
      checkStartupConfig({ TRUSTED_PROXY_HOPS: "1" }).join(" · "),
    ).not.toMatch(/TRUSTED_PROXY_HOPS/);
  });

  it("отказывает на негодном числе посредников, а не считает его нулём", () => {
    for (const value of ["-1", "полтора", "1,5", ""]) {
      expect(() => checkStartupConfig({ TRUSTED_PROXY_HOPS: value })).toThrow(
        /TRUSTED_PROXY_HOPS/,
      );
    }
  });
  it("говорит вслух, что вход в админку не настроен", () => {
    // Куплено на живом запуске 07.09.2026: `.env` был скопирован из примера и не заполнен,
    // продукт поднялся молча, а вход упал ошибкой сервера в момент нажатия кнопки —
    // по экрану это выглядит как поломка продукта, а не как незаполненная настройка.
    const notes = checkStartupConfig({}).join(" \u00b7 ");
    expect(notes).toMatch(/SESSION_SECRET/);
    expect(notes).toMatch(/ADMIN_PASSWORD_HASH/);
  });

  it("молчит про вход, когда обе переменные заданы", () => {
    const notes = checkStartupConfig({
      SESSION_SECRET: "x".repeat(32),
      ADMIN_PASSWORD_HASH: "scrypt.32768.8.3.c29sdA.a2V5",
    }).join(" \u00b7 ");
    expect(notes).not.toMatch(/SESSION_SECRET|ADMIN_PASSWORD_HASH/);
  });
});
