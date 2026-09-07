#!/usr/bin/env node
// Сквозной смоук MVP на ПОДНЯТОМ продукте (T049…T051, а после переезда — T079).
//
// Проходит весь путь продукта настоящими действиями в браузере, а не запросами к базе:
// завёл страну и пиццерию → добавил станцию → создал чек-лист с критичным пунктом →
// опубликовал → напечатал лист QR → открыл ссылку станции на телефоне шириной 375 px →
// заполнил, провалив критичный пункт с комментарием → нашёл заполнение в ленте.
//
// Сценарий параметризован адресом, поэтому один и тот же прогон годится и для локальной
// площадки, и для площадки после раскатки.
//
//   node scripts/mvp-smoke.mjs --url http://localhost:3100 --password <пароль админки>
//                              [--out reports/mvp-smoke]
//
// Каждый шаг снимается в PNG: снимки — это то, что показывают человеку, а не пересказ.
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 960 };
// Шаг ожидания: на localhost хватает 20 с, по внешнему адресу через туннель — нет.
const STEP_TIMEOUT = Number(argumentRaw("timeout") ?? 30_000);

/** Значение флага командной строки или undefined. */
function argumentRaw(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : undefined;
}

/**
 * Осталась ли выбранной станция в редакторе.
 *
 * Значение читается с самого селектора: перерисовка после серверного действия
 * возвращает список заново, и потерянный выбор виден только так.
 */
async function stationBound(page, label, timeout = STEP_TIMEOUT) {
  const select = page.getByTestId("checklist-station");
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const selected = await select
      .locator("option:checked")
      .innerText()
      .catch(() => "");
    if (selected.trim() === label) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/** Дождаться, пока элементов станет не меньше `expected`. */
async function waitForCount(locator, expected, timeout = STEP_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await locator.count()) >= expected) return;
    await locator.page().waitForTimeout(200);
  }
  throw new Error(
    `не дождался ${String(expected)} элементов: их ${String(await locator.count())}`,
  );
}

/**
 * Дождаться, пока у элемента появится нужное состояние.
 *
 * Проверка «прочитал атрибут сразу после касания» верна только на быстром localhost:
 * через туннель ответ приходит позже, и такой смоук падает на работающем продукте.
 */
async function hasState(locator, expected, timeout = STEP_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await locator.getAttribute("data-state")) === expected) return true;
    await locator.page().waitForTimeout(200);
  }
  return false;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < process.argv.length)
    return process.argv[index + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`не задан обязательный параметр --${name}`);
}

const BASE_URL = argument("url", "http://localhost:3100").replace(/\/$/, "");
const PASSWORD = argument("password");
const OUT_DIR = path.resolve(argument("out", "reports/mvp-smoke"));

const label = Math.random().toString(36).slice(2, 7);
const COUNTRY = `Smokeland ${label}`;
const STORE = `Smokeland, Harbour ${label}`;
const STATION = `Kitchen ${label}`;
const CHECKLIST = `Kitchen opening ${label}`;
const COMMENT = "Two sauce buckets are unlabelled, moved to the fridge.";

let step = 0;
const done = [];

function say(text) {
  console.log(`  ${text}`);
}

/** Проверка, которая обязана падать: смоук без падений ничего не доказывает. */
function check(condition, what) {
  if (!condition) throw new Error(`ПРОВАЛ шага «${what}»`);
  say(`✓ ${what}`);
}

async function shot(page, name) {
  step += 1;
  const file = path.join(
    OUT_DIR,
    `${String(step).padStart(2, "0")}-${name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
  done.push(file);
  say(`снимок: ${path.relative(process.cwd(), file)}`);
}

function heading(text) {
  console.log(`\n▸ ${text}`);
}

async function signIn(page) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("admin-home").waitFor({ timeout: STEP_TIMEOUT });
}

/** Значение параметра адреса у ссылки — так со страницы забирается опознаватель строки. */
async function idFromLink(locator, parameter) {
  const href = await locator.getAttribute("href");
  if (href === null) throw new Error("у ссылки нет адреса");
  const value = new URL(href, BASE_URL).searchParams.get(parameter);
  if (value === null)
    throw new Error(`в адресе ${href} нет параметра ${parameter}`);
  return value;
}

async function createCatalog(page) {
  heading("Справочник: страна → пиццерия → станция");

  await page.goto(`${BASE_URL}/admin/catalog?create=country`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('form input[name="name"]').fill(COUNTRY);
  await page.locator('form select[name="locale"]').selectOption("en");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const country = page.getByTestId("country-item").filter({ hasText: COUNTRY });
  await country.waitFor({ timeout: STEP_TIMEOUT });
  const countryId = await idFromLink(country, "country");
  check(Boolean(countryId), `страна «${COUNTRY}» заведена`);

  await page.goto(
    `${BASE_URL}/admin/catalog?country=${countryId}&create=store`,
    {
      waitUntil: "domcontentloaded",
    },
  );
  await page.locator('form input[name="name"]').fill(STORE);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const store = page.getByTestId("store-item").filter({ hasText: STORE });
  await store.waitFor({ timeout: STEP_TIMEOUT });
  const storeId = await idFromLink(store, "store");
  check(Boolean(storeId), `пиццерия «${STORE}» заведена`);

  await page.goto(
    `${BASE_URL}/admin/catalog?country=${countryId}&store=${storeId}&create=station`,
    { waitUntil: "domcontentloaded" },
  );
  await page.locator('form input[name="name"]').fill(STATION);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.getByTestId("station-row").filter({ hasText: STATION });
  await row.waitFor({ timeout: STEP_TIMEOUT });

  // Код станции — то, что уедет внутрь напечатанного QR: читаем его с экрана,
  // а не из базы, иначе смоук проверял бы не то, что видит человек.
  const code = (await row.locator("td").nth(2).innerText()).trim();
  check(
    /^[\da-z]{10}$/.test(code),
    `станция «${STATION}» заведена, код ${code}`,
  );

  await shot(page, "catalog");
  return { countryId, storeId, code };
}

async function createChecklist(page, catalog) {
  heading("Редактор: чек-лист с критичным пунктом, публикация версии");

  await page.goto(`${BASE_URL}/admin/checklists/new`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByTestId("new-checklist-form")
    .getByRole("textbox")
    .fill(CHECKLIST);
  // Круглосуточное окно: смоук обязан проходить в любой час, а не только утром.
  await page.locator("#new-checklist-window").selectOption("any");
  await page.getByTestId("create-checklist").click();
  await page.getByTestId("editor-screen").waitFor({ timeout: STEP_TIMEOUT });

  await page
    .getByTestId("checklist-station")
    .selectOption({ label: `${COUNTRY} · ${STORE} · ${STATION}` });
  // Выбор станции уходит на сервер и перерисовывает редактор. Пока перерисовка идёт,
  // клавиатурный ввод уезжает в элемент, который сейчас будет заменён, — на localhost
  // это успевало, по внешнему адресу пункты переставали создаваться вовсе.
  await page.waitForLoadState("networkidle");
  // Привязка станции уходит в черновик серверным действием. Проверяем, что она там
  // осталась: публикация читает черновик, и потерянная привязка даёт станцию без
  // чек-листа — заполнение по её QR открыть уже нельзя.
  const stationLabel = `${COUNTRY} · ${STORE} · ${STATION}`;
  const bound = await stationBound(page, stationLabel);
  check(bound, `чек-лист привязан к станции «${STATION}»`);

  const items = page.getByTestId("item-title");
  await items.first().click();
  await page.keyboard.type("Turn on the oven and the hood");
  await items.first().waitFor({ state: "visible", timeout: STEP_TIMEOUT });
  // После Enter ЖДЁМ появления следующего пункта: по внешнему адресу ответ идёт через
  // туннель, и следующая строка текста уезжала в пункт, которого ещё нет.
  await page.keyboard.press("Enter");
  await waitForCount(items, 2);
  await page.keyboard.type("Fryer temperature");
  await page.keyboard.press("Enter");
  await waitForCount(items, 3);
  await page.keyboard.type("Check labels on the sauces");

  await page.getByTestId("item-type").nth(1).selectOption("number");
  await page.getByTestId("item-min").first().fill("160");
  await page.getByTestId("item-max").first().fill("180");
  await page.getByTestId("item-critical").nth(2).click();
  check(
    (await page
      .getByTestId("editor-item")
      .nth(2)
      .getAttribute("data-critical")) === "true",
    "третий пункт помечен критичным",
  );

  await page.getByTestId("save-draft").click();
  await page
    .getByTestId("editor-meta")
    .filter({ hasText: "Draft saved" })
    .waitFor({
      timeout: STEP_TIMEOUT,
    });
  await shot(page, "editor");

  await page.getByTestId("publish").click();
  await page.getByTestId("editor-published").waitFor({ timeout: STEP_TIMEOUT });
  const published = await page.getByTestId("editor-published").innerText();
  check(published.includes("1"), `версия опубликована: «${published.trim()}»`);

  return catalog;
}

async function printQr(page, storeId) {
  heading("Печать: лист QR-кодов станций");

  await page.goto(`${BASE_URL}/admin/qr?store=${storeId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("qr-sheet").waitFor({ timeout: STEP_TIMEOUT });
  const stickers = await page.getByTestId("qr-sticker").count();
  check(stickers >= 1, `лист печати собран, наклеек на нём ${stickers}`);
  check(
    (await page.getByTestId("qr-sticker").first().locator("svg").count()) === 1,
    "на наклейке нарисован сам код",
  );
  await shot(page, "qr-sheet");
}

async function fillFromPhone(browser, code) {
  heading("Телефон 375 px: заполнение по ссылке станции");

  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    locale: "en-GB",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/s/${code}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("fill-screen").waitFor({ timeout: STEP_TIMEOUT });
    check(
      await page.getByText(CHECKLIST).isVisible(),
      `ссылка станции открыла чек-лист «${CHECKLIST}»`,
    );

    const bools = page.locator('[data-testid="fill-item"][data-state]');
    const oven = bools.nth(0);
    await oven.tap();
    await page.getByTestId("fill-number").fill("172");

    // Критичный пункт проваливается вторым касанием: «да» → «нет».
    const critical = bools.nth(2);
    await critical.tap();
    await critical.tap();
    // Состояние ЖДЁМ, а не читаем сразу: по внешнему адресу ответ идёт через туннель,
    // и мгновенное чтение атрибута ловит предыдущее состояние — смоук падал на этом
    // шаге на живой площадке, хотя продукт работал.
    check(
      await hasState(critical, "no"),
      "критичный пункт отмечен как не выполненный",
    );

    const comment = page.getByTestId("fill-comment");
    await comment.waitFor({ timeout: STEP_TIMEOUT });
    check(
      await page.getByTestId("fill-submit").isDisabled(),
      "без объяснения провала отправка не даётся",
    );
    await comment.fill(COMMENT);

    // Горизонтальной прокрутки на телефоне быть не должно — это требование экрана.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    check(overflow <= 0, "горизонтальной прокрутки на 375 px нет");
    await shot(page, "fill-375px");

    await page.getByTestId("fill-submit").tap();
    await page.getByTestId("fill-sent").waitFor({ timeout: STEP_TIMEOUT });
    check(true, "заполнение отправлено");
    await shot(page, "fill-sent");
  } finally {
    await context.close();
  }
}

async function findInFeed(page) {
  heading("Лента: заполнение видно управляющему");

  await page.goto(`${BASE_URL}/admin/feed`, { waitUntil: "domcontentloaded" });
  const row = page.getByTestId("submission-row").filter({ hasText: STATION });
  await row.first().waitFor({ timeout: STEP_TIMEOUT });
  check((await row.count()) === 1, `в ленте одна строка станции «${STATION}»`);
  await shot(page, "feed");

  await row.first().getByRole("link").first().click();
  await page
    .getByTestId("submission-screen")
    .waitFor({ timeout: STEP_TIMEOUT });
  const card = await page.locator("body").innerText();
  check(
    card.includes(COMMENT),
    "карточка показывает комментарий к проваленному пункту",
  );
  check(
    card.includes("Check labels on the sauces"),
    "карточка показывает пункты снимка",
  );
  await shot(page, "submission");
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Сквозной смоук MVP по адресу ${BASE_URL}`);
console.log(`Снимки: ${OUT_DIR}\n`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: DESKTOP,
  locale: "en-US",
});
const page = await context.newPage();
let failure;
try {
  await signIn(page);
  const catalog = await createCatalog(page);
  await createChecklist(page, catalog);
  await printQr(page, catalog.storeId);
  await fillFromPhone(browser, catalog.code);
  await findInFeed(page);
} catch (error) {
  failure = error;
  try {
    await shot(page, "failure");
  } catch {
    // Снимок мог не сняться (страница закрыта) — это не должно прятать саму ошибку.
  }
} finally {
  await context.close();
  await browser.close();
}

if (failure !== undefined) {
  console.error(`\nСМОУК НЕ ПРОШЁЛ: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log(`\nСКВОЗНОЙ СЦЕНАРИЙ MVP ПРОЙДЕН. Снимков: ${done.length}`);
}
