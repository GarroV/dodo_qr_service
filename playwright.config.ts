import { defineConfig, devices } from "@playwright/test";

// Порт из диапазона этой копии репозитория (3100–3109). 3100 остаётся за `npm run dev`,
// сквозные сценарии поднимают свой сервер на 3101 и не мешают разработке.
const PORT = 3101;
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
  },
});
