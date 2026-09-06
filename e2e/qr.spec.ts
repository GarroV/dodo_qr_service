// Сквозной сценарий блока QR: лист печати, содержимое самого кода, поведение при
// печати и экран планшета, который переживает перевыпуск кода без рук.
//
// Код проверяется не по разметке, а чтением картинки обратно — тем же способом,
// каким его читает камера.
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Pool } from "pg";

import { decodeQrSvg } from "../src/blocks/qr/testing/decode-svg";
import { E2E_ADMIN_PASSWORD } from "./admin-credentials";
import { e2eDatabaseUrl } from "./database";
import { E2E_PUBLIC_BASE_URL } from "./public-base-url";

const QR_PATH = "/admin/qr";
const STATION_NAMES = ["Касса", "Кухня", "Упаковка"];

/** Алфавит кода станции: без похожих знаков (`0`, `1`, `i`, `l`, `o`) — решение D031. */
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

interface SeededStore {
  storeId: string;
  storeName: string;
  countryName: string;
  stationNames: string[];
}

function code(): string {
  return Array.from(
    { length: 10 },
    () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)] ?? "z",
  ).join("");
}

/**
 * Пиццерия с тремя станциями прямо в базе. Через экран справочника заводить незачем:
 * сценарий проверяет блок QR, а не чужой блок, и лишние шаги делают падение
 * непонятным — упало бы в справочнике, а искали бы в QR.
 */
async function seedStore(): Promise<SeededStore> {
  const label = randomUUID().slice(0, 8);
  const pool = new Pool({ connectionString: e2eDatabaseUrl() });
  try {
    const country = await pool.query<{ id: string }>(
      "insert into countries (name, locale) values ($1, 'ru') returning id",
      [`Страна ${label}`],
    );
    const countryId = country.rows[0]?.id;
    const store = await pool.query<{ id: string }>(
      "insert into stores (country_id, name, timezone) values ($1, $2, 'Asia/Almaty') returning id",
      [countryId, `Пиццерия ${label}`],
    );
    const storeId = store.rows[0]?.id;
    if (storeId === undefined)
      throw new Error("Пиццерия для сценария не завелась");

    for (const name of STATION_NAMES) {
      await pool.query(
        "insert into stations (store_id, name, code) values ($1, $2, $3)",
        [storeId, `${name} ${label}`, code()],
      );
    }

    return {
      storeId,
      storeName: `Пиццерия ${label}`,
      countryName: `Страна ${label}`,
      stationNames: STATION_NAMES.map((name) => `${name} ${label}`),
    };
  } finally {
    await pool.end();
  }
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("admin-home")).toBeVisible();
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
    await page.getByTestId("reissue-code").first().click();
    await expect(page.getByTestId("qr-sheet")).toBeVisible();

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
    await admin.getByTestId("reissue-code").first().click();
    await expect(admin.getByTestId("qr-sheet")).toBeVisible();
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
