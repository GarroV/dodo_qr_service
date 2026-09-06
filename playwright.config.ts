import { defineConfig, devices } from "@playwright/test";

import {
  E2E_ADMIN_PASSWORD_HASH,
  E2E_SESSION_SECRET,
} from "./e2e/admin-credentials";

// Порт из диапазона этой копии репозитория (3100–3109). 3100 остаётся за `npm run dev`,
// сквозные сценарии поднимают свой сервер на 3101 и не мешают разработке.
// E2E_PORT переопределяет его: параллельные копии репозитория (стройка блоками) иначе
// делят один порт, и reuseExistingServer молча подцепляет чужой сервер с чужим кодом.
const PORT = Number(process.env["E2E_PORT"] ?? "3101");
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [
    ["list"],
    ["junit", { outputFile: "reports/playwright.junit.xml" }],
  ],
  use: {
    baseURL: BASE_URL,
    // Тема фиксирована: токены дизайн-системы отдают в тёмной теме другой акцент.
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Продакшен-сборка, а не dev: Next 16 не поднимает второй dev-сервер на тот же каталог,
    // и проверять всё равно правильнее то, что уедет на площадку.
    command: `npx next build && npx next start --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    // Вход в админку читает эти переменные. Значения тестовые и лежат рядом в e2e/:
    // рабочие живут в .env, который в git не попадает.
    env: {
      ADMIN_PASSWORD_HASH: E2E_ADMIN_PASSWORD_HASH,
      SESSION_SECRET: E2E_SESSION_SECRET,
    },
  },
});
