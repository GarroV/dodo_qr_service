import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { hasAdminSession, requireAdmin } from "./guard";
import { LOGIN_PATH } from "./routes";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "./session";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: () => {
        // Ставить куку в тесте охраны маршрутов нечему: только чтение.
      },
      delete: () => {
        // То же: удаление проверяется в тесте действий входа.
      },
    }),
}));

// Настоящий redirect() бросает исключение и не возвращает управление — подмена делает то же,
// иначе тест «страница не отдала данные» проходил бы на коде, который просто идёт дальше.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
}));

const SECRET = "секрет-подписи-сессии-достаточной-длины-1234567890";

beforeEach(() => {
  jar.clear();
  process.env["SESSION_SECRET"] = SECRET;
});

afterEach(() => {
  delete process.env["SESSION_SECRET"];
});

describe("requireAdmin", () => {
  test("без куки уводит на форму входа", async () => {
    await expect(requireAdmin()).rejects.toThrow(`NEXT_REDIRECT ${LOGIN_PATH}`);
    expect(LOGIN_PATH).toBe("/admin/login");
  });

  test("с действующей сессией пропускает дальше", async () => {
    jar.set(SESSION_COOKIE_NAME, createSessionToken(SECRET, new Date()));

    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  test("с просроченной сессией уводит на форму входа", async () => {
    const longAgo = new Date(
      Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000,
    );
    jar.set(SESSION_COOKIE_NAME, createSessionToken(SECRET, longAgo));

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
  });

  test("с подделанной кукой уводит на форму входа", async () => {
    jar.set(
      SESSION_COOKIE_NAME,
      createSessionToken("подобранный-секрет-злоумышленника", new Date()),
    );

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
  });

  test("на мусоре в куке уводит на форму входа, а не падает пятисоткой", async () => {
    jar.set(SESSION_COOKIE_NAME, "-- не кука --");

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
  });

  test("без SESSION_SECRET не пускает никого: падает, а не считает сессию годной", async () => {
    delete process.env["SESSION_SECRET"];
    jar.set(SESSION_COOKIE_NAME, createSessionToken(SECRET, new Date()));

    await expect(requireAdmin()).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("hasAdminSession", () => {
  test("отвечает true только на действующую сессию", async () => {
    await expect(hasAdminSession()).resolves.toBe(false);

    jar.set(SESSION_COOKIE_NAME, createSessionToken(SECRET, new Date()));

    await expect(hasAdminSession()).resolves.toBe(true);
  });
});
