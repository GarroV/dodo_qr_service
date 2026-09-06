import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { signIn, signOut } from "./actions";
import { hashPassword } from "./password";
import { SESSION_COOKIE_NAME, readSessionToken } from "./session";

interface StoredCookie {
  readonly value: string;
  readonly options: Record<string, unknown>;
}

// Кука живёт в запросе, которого в модульном тесте нет: подменяем хранилище Next своим.
const jar = vi.hoisted(
  () => new Map<string, { value: string; options: Record<string, unknown> }>(),
);

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const found = jar.get(name);
        return found === undefined ? undefined : { name, value: found.value };
      },
      set: (name: string, value: string, options: Record<string, unknown>) => {
        jar.set(name, { value, options });
      },
      delete: (target: string | { name: string }) => {
        jar.delete(typeof target === "string" ? target : target.name);
      },
    }),
}));

const PASSWORD = "пароль-методиста";
const SECRET = "секрет-подписи-сессии-достаточной-длины-1234567890";
const SHORT_SECRET = "короткий";
const BROKEN_HASH = "испорченный-хэш";

function sessionCookie(): StoredCookie | undefined {
  return jar.get(SESSION_COOKIE_NAME);
}

async function cheapHash(): Promise<string> {
  return hashPassword(PASSWORD, {
    cost: 1024,
    blockSize: 8,
    parallelization: 1,
  });
}

beforeEach(async () => {
  jar.clear();
  process.env["ADMIN_PASSWORD_HASH"] = await cheapHash();
  process.env["SESSION_SECRET"] = SECRET;
});

afterEach(() => {
  delete process.env["ADMIN_PASSWORD_HASH"];
  delete process.env["SESSION_SECRET"];
});

describe("signIn", () => {
  test("на верный пароль ставит подписанную куку и отвечает true", async () => {
    await expect(signIn(PASSWORD)).resolves.toBe(true);

    const cookie = sessionCookie();
    expect(cookie).toBeDefined();
    expect(
      readSessionToken(cookie?.value ?? "", SECRET, new Date()),
    ).not.toBeNull();
  });

  test("кука httpOnly, sameSite lax, на весь сайт и на 30 дней", async () => {
    await signIn(PASSWORD);

    const options = sessionCookie()?.options;
    expect(options?.["httpOnly"]).toBe(true);
    expect(options?.["sameSite"]).toBe("lax");
    expect(options?.["path"]).toBe("/");
    expect(options?.["maxAge"]).toBe(30 * 24 * 60 * 60);
  });

  test("на неверный пароль отвечает false и не ставит куку", async () => {
    await expect(signIn("не тот пароль")).resolves.toBe(false);

    expect(sessionCookie()).toBeUndefined();
  });

  test("в куке нет ни пароля, ни секрета подписи", async () => {
    await signIn(PASSWORD);

    const value = sessionCookie()?.value ?? "";
    const payload = Buffer.from(
      value.split(".")[0] ?? "",
      "base64url",
    ).toString("utf8");
    expect(value).not.toContain(PASSWORD);
    expect(value).not.toContain(SECRET);
    expect(payload).not.toContain(PASSWORD);
    expect(payload).not.toContain(SECRET);
  });

  test("без ADMIN_PASSWORD_HASH падает и никого не пускает", async () => {
    delete process.env["ADMIN_PASSWORD_HASH"];

    await expect(signIn(PASSWORD)).rejects.toThrow(/ADMIN_PASSWORD_HASH/);
    expect(sessionCookie()).toBeUndefined();
  });

  test("без SESSION_SECRET падает и не ставит куку без подписи", async () => {
    delete process.env["SESSION_SECRET"];

    await expect(signIn(PASSWORD)).rejects.toThrow(/SESSION_SECRET/);
    expect(sessionCookie()).toBeUndefined();
  });

  test("на слишком коротком SESSION_SECRET падает, а не подписывает угадываемым", async () => {
    process.env["SESSION_SECRET"] = SHORT_SECRET;

    await expect(signIn(PASSWORD)).rejects.toThrow(/SESSION_SECRET/);
    expect(sessionCookie()).toBeUndefined();
  });

  test("сообщения об ошибках не выносят наружу ни пароль, ни секрет", async () => {
    delete process.env["ADMIN_PASSWORD_HASH"];
    const withoutHash = await signIn(PASSWORD).catch((reason: unknown) =>
      String(reason),
    );

    process.env["ADMIN_PASSWORD_HASH"] = BROKEN_HASH;
    const withBrokenHash = await signIn(PASSWORD).catch((reason: unknown) =>
      String(reason),
    );

    process.env["ADMIN_PASSWORD_HASH"] = await cheapHash();
    process.env["SESSION_SECRET"] = SHORT_SECRET;
    const withShortSecret = await signIn(PASSWORD).catch((reason: unknown) =>
      String(reason),
    );

    for (const message of [withoutHash, withBrokenHash, withShortSecret]) {
      expect(message).not.toContain(PASSWORD);
      expect(message).not.toContain(SHORT_SECRET);
      expect(message).not.toContain(BROKEN_HASH);
    }
  });
});

describe("signOut", () => {
  test("убирает куку сессии", async () => {
    await signIn(PASSWORD);
    expect(sessionCookie()).toBeDefined();

    await signOut();

    expect(sessionCookie()).toBeUndefined();
  });

  test("на выходе без сессии не падает", async () => {
    await expect(signOut()).resolves.toBeUndefined();
  });
});
