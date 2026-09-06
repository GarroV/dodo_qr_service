import { expect, test } from "@playwright/test";

// Риск из техплана: next-intl в Next 16 (где middleware.ts переименован в proxy.ts)
// описан только сообществом. Проверяем сценарий кухни: язык телефона, без входа и без cookie.
test.describe("язык страницы по заголовку браузера", () => {
  test.describe("русский телефон", () => {
    test.use({ locale: "ru-RU" });

    test("получает русский текст и lang=ru", async ({ page, context }) => {
      await page.goto("/");

      await expect(page.getByTestId("title")).toHaveText("Цифровые чек-листы");
      await expect(page.locator("html")).toHaveAttribute("lang", "ru");
      expect(await context.cookies()).toHaveLength(0);
    });
  });

  test.describe("английский телефон", () => {
    test.use({ locale: "en-US" });

    test("получает английский текст и lang=en", async ({ page, context }) => {
      await page.goto("/");

      await expect(page.getByTestId("title")).toHaveText("Digital checklists");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      expect(await context.cookies()).toHaveLength(0);
    });
  });

  test.describe("телефон с неподдержанным языком", () => {
    test.use({ locale: "fr-FR" });

    test("получает язык по умолчанию, а не ошибку", async ({ page }) => {
      await page.goto("/");

      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });
});
