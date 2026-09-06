import { expect, test } from "@playwright/test";

import { adminRoutes } from "./admin-routes";

const LOGIN_PATH = "/admin/login";
const ROUTES = adminRoutes();

test.describe("админка закрыта: без сессии ни один её маршрут не отдаёт данные", () => {
  test("маршруты админки вообще нашлись", () => {
    // Пустой перебор молча превратил бы весь набор ниже в ноль проверок.
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(ROUTES.map((route) => route.url)).toContain("/admin");
  });

  for (const route of ROUTES) {
    test(`${route.kind === "page" ? "экран" : "обработчик"} ${route.url} (${route.file})`, async ({
      request,
    }) => {
      const response = await request.get(route.url, { maxRedirects: 0 });

      if (route.kind === "page") {
        expect(
          [307, 308],
          `${route.file}: экран без сессии обязан уводить на форму входа`,
        ).toContain(response.status());
        expect(response.headers()["location"]).toContain(LOGIN_PATH);
        return;
      }

      // Обработчик `route.ts` выполняется мимо разметки, значит охрана в layout.tsx его
      // не закрывает: он обязан звать requireAdmin() сам. Ответ 2xx без сессии — дыра.
      const succeeded = response.status() >= 200 && response.status() < 300;
      expect(
        succeeded,
        `${route.file}: обработчик без сессии ответил успехом — не хватает requireAdmin()`,
      ).toBe(false);
    });
  }

  test("экран админки без сессии показывает форму входа, а не свои данные", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(new RegExp(`${LOGIN_PATH}$`));
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByTestId("admin-home")).toHaveCount(0);
    expect(await page.content()).not.toContain("Разделы появятся здесь");
  });

  test("несуществующий экран админки тоже не отдаётся без сессии", async ({
    request,
  }) => {
    // Отказ приходит от охраны раньше, чем Next успевает сказать «нет такой страницы»:
    // перебор адресов админки не подсказывает, какие разделы в ней есть.
    const response = await request.get("/admin/такого-раздела-нет", {
      maxRedirects: 0,
    });

    expect([307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain(LOGIN_PATH);
  });

  test("публичный маршрут заполнения вход не спрашивает", async ({
    request,
  }) => {
    // Блок fill появится позже; сейчас проверяется главное: /s/* не заворачивается на вход
    // и вообще не знает про сессию. Границу на уровне импортов держит .dependency-cruiser.cjs.
    const response = await request.get("/s/ABCDEFGHJK", { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers()["location"]).toBeUndefined();
  });
});
