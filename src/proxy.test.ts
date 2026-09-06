import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { SESSION_COOKIE_NAME, createSessionToken } from "@/blocks/auth/session";

import { config, proxy } from "./proxy";

const SECRET = "секрет-подписи-сессии-достаточной-длины-1234567890";
const ORIGIN = "http://localhost:3100";

function requestTo(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

function validCookie(): string {
  return createSessionToken(SECRET, new Date());
}

beforeEach(() => {
  process.env["SESSION_SECRET"] = SECRET;
});

afterEach(() => {
  delete process.env["SESSION_SECRET"];
});

describe("охрана перед рендером", () => {
  test("сторожит весь /admin, включая вложенные адреса", () => {
    expect(config.matcher).toEqual(["/admin/:path*"]);
  });

  test("без куки уводит на форму входа", () => {
    const response = proxy(requestTo("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login`);
  });

  test("уводит и с вложенного адреса, и с несуществующего", () => {
    for (const path of ["/admin/checklists/17/edit", "/admin/такого-нет"]) {
      expect(proxy(requestTo(path)).status).toBe(307);
    }
  });

  test("с действующей сессией пропускает дальше", () => {
    const response = proxy(requestTo("/admin", validCookie()));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("с подделанной и с мусорной кукой уводит на форму входа", () => {
    const forged = createSessionToken(
      "секрет-подобранный-злоумышленником",
      new Date(),
    );

    expect(proxy(requestTo("/admin", forged)).status).toBe(307);
    // Мусор в куке пишется латиницей: заголовок HTTP не переносит символы за пределами
    // одного байта, и кириллица здесь падала бы на конструкторе запроса, а не на проверке.
    expect(proxy(requestTo("/admin", "not.a.cookie")).status).toBe(307);
  });

  test("форму входа пропускает без сессии — иначе она заворачивала бы сама себя", () => {
    expect(proxy(requestTo("/admin/login")).status).toBe(200);
    expect(proxy(requestTo("/admin/login/")).status).toBe(200);
  });

  test("запрошенный адрес не переезжает в ссылку на вход: открытому редиректу неоткуда взяться", () => {
    const response = proxy(
      requestTo("/admin/feed?next=https://чужой-сайт.example"),
    );

    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login`);
  });

  test("без SESSION_SECRET не пускает: падает, а не считает куку годной", () => {
    delete process.env["SESSION_SECRET"];

    expect(() => proxy(requestTo("/admin", validCookie()))).toThrow(
      /SESSION_SECRET/,
    );
  });
});
