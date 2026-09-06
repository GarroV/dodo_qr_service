// Сквозной сценарий редактора: то, ради чего блок и строился. Чек-лист набирается
// с клавиатуры, список вставляется из буфера одним нажатием, черновик сохраняется,
// версия публикуется, предпросмотр показывает то же, что увидит сотрудник.
//
// Клавиатура проверяется настоящими событиями браузера (page.keyboard), а вставка —
// настоящим буфером обмена: вызов обработчика напрямую доказал бы только то, что
// обработчик существует.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD } from "./admin-credentials";
import { seedStation } from "./database";

const CHECKLISTS_PATH = "/admin/checklists";

// Список ровно в том виде, в каком его копируют из Word: маркеры, нумерация,
// лишние пробелы и пустая строка посередине.
const PASTED_LIST = [
  "• Открыть смену",
  "• Проверить холодильник",
  "",
  "1. Помыть пол",
  "2) Протереть витрину",
  "   -  Проверить кассу  ",
  "5 кг теста достать из морозилки",
].join("\n");
const PASTED_ITEMS = 6;

function label(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("admin-home")).toBeVisible();
}

/** Заводит чек-лист через экран заведения и возвращает адрес его редактора. */
async function createChecklist(page: Page, title: string): Promise<string> {
  await page.goto(`${CHECKLISTS_PATH}/new`);
  await page.getByTestId("new-checklist-form").getByRole("textbox").fill(title);
  await page.getByTestId("create-checklist").click();
  await expect(page.getByTestId("editor-screen")).toBeVisible();
  return page.url();
}

test.describe("редактор чек-листа", () => {
  // Эталон и тексты сценария русские, поэтому и браузер русский.
  test.use({ locale: "ru-RU" });

  test("пункты набираются с клавиатуры: Enter создаёт следующий и уводит в него курсор", async ({
    page,
  }) => {
    await signIn(page);
    await createChecklist(page, `Открытие кухни ${label()}`);

    const items = page.getByTestId("item-title");
    await expect(items).toHaveCount(1);

    await items.first().click();
    await page.keyboard.type("Включить печь");
    await page.keyboard.press("Enter");

    // Курсор уже в новом пункте: методист печатает дальше, не трогая мышь.
    await expect(items).toHaveCount(2);
    await page.keyboard.type("Проверить фритюр");
    await expect(items.nth(1)).toHaveValue("Проверить фритюр");

    await page.keyboard.press("Enter");
    await page.keyboard.type("Протереть столы");
    await expect(items).toHaveCount(3);
    await expect(items.nth(2)).toHaveValue("Протереть столы");
  });

  test("Alt+стрелки переставляют пункт и оставляют на нём курсор", async ({
    page,
  }) => {
    await signIn(page);
    await createChecklist(page, `Порядок пунктов ${label()}`);

    const items = page.getByTestId("item-title");
    await items.first().click();
    await page.keyboard.type("Первый");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Второй");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Третий");

    await page.keyboard.press("Alt+ArrowUp");

    await expect(items.nth(1)).toHaveValue("Третий");
    await expect(items.nth(2)).toHaveValue("Второй");
    // Курсор поехал вместе с пунктом: следующее нажатие продолжает править его же.
    await expect(page.locator(":focus")).toHaveValue("Третий");

    await page.keyboard.press("Alt+ArrowDown");
    await expect(items.nth(1)).toHaveValue("Второй");
    await expect(items.nth(2)).toHaveValue("Третий");

    // На нижней границе секции пункт остаётся на месте, а не исчезает в соседней.
    await page.keyboard.press("Alt+ArrowDown");
    await expect(items.nth(2)).toHaveValue("Третий");
    await expect(items).toHaveCount(3);
  });

  test("список из буфера превращается в пункты одним нажатием", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page);
    await createChecklist(page, `Вставка списка ${label()}`);

    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, PASTED_LIST);

    const items = page.getByTestId("item-title");
    await items.first().click();
    await page.keyboard.press("ControlOrMeta+KeyV");

    // Одно нажатие — все строки списка. Пустая строка пропущена, маркеры и нумерация сняты.
    await expect(items).toHaveCount(PASTED_ITEMS);
    await expect(items.nth(0)).toHaveValue("Открыть смену");
    await expect(items.nth(2)).toHaveValue("Помыть пол");
    await expect(items.nth(3)).toHaveValue("Протереть витрину");
    await expect(items.nth(4)).toHaveValue("Проверить кассу");
    // Число без точки и скобки нумерацией не считается: строка осталась целой.
    await expect(items.nth(5)).toHaveValue("5 кг теста достать из морозилки");
  });

  test("тип ответа, границы числа и критичность переключаются по месту и сохраняются", async ({
    page,
  }) => {
    await signIn(page);
    await createChecklist(page, `Типы ответов ${label()}`);

    const items = page.getByTestId("item-title");
    await items.first().click();
    await page.keyboard.type("Температура фритюра");

    await page.getByTestId("item-type").first().selectOption("number");
    await page.getByTestId("item-min").first().fill("160");
    await page.getByTestId("item-max").first().fill("180");
    await page.getByTestId("item-critical").first().click();

    await expect(page.getByTestId("editor-item").first()).toHaveAttribute(
      "data-critical",
      "true",
    );

    await page.getByTestId("save-draft").click();
    await expect(page.getByTestId("editor-meta")).toHaveText(
      "Черновик сохранён",
    );

    await page.reload();
    await expect(page.getByTestId("item-type").first()).toHaveValue("number");
    await expect(page.getByTestId("item-min").first()).toHaveValue("160");
    await expect(page.getByTestId("item-max").first()).toHaveValue("180");
    await expect(page.getByTestId("editor-item").first()).toHaveAttribute(
      "data-critical",
      "true",
    );
  });

  test("черновик сохраняется, версия публикуется, предпросмотр показывает то же самое", async ({
    page,
    context,
  }) => {
    const station = await seedStation(label());
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page);
    const editorUrl = await createChecklist(page, `Открытие кухни ${label()}`);

    // Привязка к станции: без неё QR ничего не откроет.
    await page
      .getByTestId("checklist-station")
      .selectOption({
        label: `${station.countryName} · ${station.storeName} · ${station.stationName}`,
      });

    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, PASTED_LIST);
    await page.getByTestId("item-title").first().click();
    await page.keyboard.press("ControlOrMeta+KeyV");
    await expect(page.getByTestId("item-title")).toHaveCount(PASTED_ITEMS);

    await page.getByTestId("save-draft").click();
    await expect(page.getByTestId("editor-meta")).toHaveText(
      "Черновик сохранён",
    );

    // Правка пережила перезагрузку — значит она в базе, а не только на экране.
    await page.reload();
    await expect(page.getByTestId("item-title")).toHaveCount(PASTED_ITEMS);
    await expect(page.getByTestId("item-title").first()).toHaveValue(
      "Открыть смену",
    );

    await page.getByTestId("publish").click();
    await expect(page.getByTestId("editor-published")).toContainText("1");

    // Черновик остался черновиком, рядом появилась опубликованная версия.
    await page.reload();
    await expect(page.getByTestId("version-row")).toHaveCount(2);

    await page.getByRole("link", { name: "Предпросмотр" }).click();
    await expect(page.getByTestId("preview-screen")).toBeVisible();
    await expect(page.getByTestId("preview-item")).toHaveCount(PASTED_ITEMS);
    await expect(page.getByTestId("preview-screen")).toContainText(
      station.stationName,
    );

    await page.goto(editorUrl);
    await expect(page.getByTestId("editor-screen")).toBeVisible();
  });

  test("список чек-листов показывает заведённый и дублирует его", async ({
    page,
  }) => {
    const title = `Закрытие кухни ${label()}`;
    await signIn(page);
    await createChecklist(page, title);
    await page.getByTestId("item-title").first().click();
    await page.keyboard.type("Выключить печь");
    await page.getByTestId("save-draft").click();
    await expect(page.getByTestId("editor-meta")).toHaveText(
      "Черновик сохранён",
    );

    await page.goto(CHECKLISTS_PATH);
    const row = page
      .getByTestId("checklist-row")
      .filter({ hasText: title })
      .first();
    await expect(row).toBeVisible();

    await row.getByTestId("duplicate-checklist").click();

    // Копия открывается сразу в редакторе, с теми же пунктами и своим названием.
    await expect(page.getByTestId("editor-screen")).toBeVisible();
    await expect(page.getByTestId("checklist-title")).toHaveValue(
      `${title} (копия)`,
    );
    await expect(page.getByTestId("item-title").first()).toHaveValue(
      "Выключить печь",
    );
  });
});
