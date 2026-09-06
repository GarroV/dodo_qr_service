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
});
