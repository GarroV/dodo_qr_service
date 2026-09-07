// Сквозной сценарий блока QR: лист печати, содержимое самого кода, поведение при
// печати и экран планшета, который переживает перевыпуск кода без рук.
//
// Код проверяется не по разметке, а чтением картинки обратно — тем же способом,
// каким его читает камера.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { decodeQrSvg } from "../src/blocks/qr/testing/decode-svg";
import { E2E_ADMIN_PASSWORD } from "./admin-credentials";
import { E2E_PUBLIC_BASE_URL } from "./public-base-url";
import { seedStore, STATION_NAMES } from "./station-fixtures";

const QR_PATH = "/admin/qr";

async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("admin-home")).toBeVisible();
}

/** Код первой станции в таблице — по нему видно, что перевыпуск уже доехал. */
function firstStationCode(page: Page) {
  return page
    .getByTestId("qr-stations")
    .locator("tbody tr td:nth-child(2)")
    .first();
}

/**
 * Перевыпускает код первой станции и ДОЖИДАЕТСЯ, что он сменился на экране.
 *
 * Ждать появления самого листа бесполезно: он на странице и до нажатия, поэтому
 * проверка проскакивала вперёд перехода и читала прежний код. Поймано руками на
 * живом экране — в базе код менялся уже после того, как сценарий его прочитал.
 */
async function reissueFirstStation(page: Page): Promise<void> {
  const code = firstStationCode(page);
  const before = await code.innerText();

  await page.getByTestId("reissue-code").first().click();
  await expect(code).not.toHaveText(before);
}

/** Разметка картинки первой наклейки — по ней и читается код. */
async function firstStickerSvg(page: Page): Promise<string> {
  return page
    .getByTestId("qr-sticker")
    .first()
    .locator("svg")
    .evaluate((node) => node.outerHTML);
}

test.describe("QR-коды станций", () => {
  // Эталон и тексты сценария русские, поэтому и браузер русский.
  test.use({ locale: "ru-RU" });

  test("на листе наклейка каждой станции, и в коде — публичный адрес площадки", async ({
    page,
  }) => {
    const store = await seedStore();
    await signIn(page);
    await page.goto(`${QR_PATH}?store=${store.storeId}`);

    await expect(page.getByTestId("qr-screen")).toBeVisible();
    await expect(page.getByTestId("qr-sticker")).toHaveCount(
      STATION_NAMES.length,
    );

    // На каждой наклейке — станция и пиццерия: критерий готовности блока.
    for (const name of store.stationNames) {
      await expect(
        page.getByTestId("qr-sticker").filter({ hasText: name }),
      ).toHaveCount(1);
    }
    await expect(
      page.getByTestId("qr-sticker").filter({ hasText: store.storeName }),
    ).toHaveCount(STATION_NAMES.length);

    // Главное: внутри кода — адрес из окружения площадки, а не адрес, на котором
    // открыта админка (сервер прогона слушает localhost).
    const scanned = decodeQrSvg(await firstStickerSvg(page));
    expect(scanned.startsWith(`${E2E_PUBLIC_BASE_URL}/s/`)).toBe(true);
    expect(scanned).not.toContain("localhost");
  });

  test("при печати на листе нет ни меню, ни кнопок, ни фона приложения", async ({
    page,
  }) => {
    const store = await seedStore();
    await signIn(page);
    await page.goto(`${QR_PATH}?store=${store.storeId}`);
    await expect(page.getByTestId("qr-sheet")).toBeVisible();

    await page.emulateMedia({ media: "print" });

    await expect(page.getByTestId("qr-sheet")).toBeVisible();
    await expect(page.getByTestId("qr-sticker").first()).toBeVisible();
    await expect(page.locator("nav")).toBeHidden();
    await expect(page.getByTestId("qr-print")).toBeHidden();
    await expect(page.getByTestId("reissue-code").first()).toBeHidden();
    await expect(page.getByTestId("qr-stations")).toBeHidden();
  });

  test("перевыпуск кода меняет наклейку станции", async ({ page }) => {
    const store = await seedStore();
    await signIn(page);
    await page.goto(`${QR_PATH}?store=${store.storeId}`);

    const before = decodeQrSvg(await firstStickerSvg(page));
    await reissueFirstStation(page);

    const after = decodeQrSvg(await firstStickerSvg(page));
    expect(after).not.toBe(before);
    expect(after.startsWith(`${E2E_PUBLIC_BASE_URL}/s/`)).toBe(true);
  });

  test("экран планшета показывает новый код без ручного обновления страницы", async ({
    page,
    context,
  }) => {
    const store = await seedStore();
    await signIn(page);
    await page.goto(`${QR_PATH}?store=${store.storeId}`);
    await page.getByTestId("qr-open-screen").click();

    await expect(page.getByTestId("station-screen")).toBeVisible();
    const shown = page.getByTestId("station-qr");
    const before = await shown.innerHTML();

    // Перевыпуск делают в другом окне админки — планшета в этот момент никто не
    // касается. Именно так это и происходит в жизни.
    const admin = await context.newPage();
    await admin.goto(`${QR_PATH}?store=${store.storeId}`);
    // Окно закрывается только после того, как перевыпуск доехал: закрытая
    // вкладка посреди серверного действия оборвала бы его.
    await reissueFirstStation(admin);
    await admin.close();

    // Ни перезагрузки, ни нажатий на самом планшете: экран обязан обновиться сам.
    await expect
      .poll(async () => shown.innerHTML(), { timeout: 30_000 })
      .not.toBe(before);
  });

  test("чужая станция во весь экран не открывается", async ({ page }) => {
    const store = await seedStore();
    const other = await seedStore();
    await signIn(page);

    // Ссылка собрана руками: пиццерия одна, станция из другой.
    await page.goto(`${QR_PATH}?store=${store.storeId}`);
    const alienScreen = await page
      .getByTestId("qr-open-screen")
      .getAttribute("href");
    expect(alienScreen).not.toBeNull();

    await page.goto(
      `/admin/qr/screen?store=${other.storeId}&station=${
        new URL(alienScreen ?? "", "http://localhost").searchParams.get(
          "station",
        ) ?? ""
      }`,
    );

    await expect(page.getByTestId("station-screen")).toHaveCount(0);
  });
});
