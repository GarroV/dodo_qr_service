import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Тестовая база готовится один раз на прогон: создаётся, если её нет, сносится
    // и накатывается миграциями с нуля. Базы нет — прогон падает с указанием, как её
    // поднять: молча пропущенная проверка неотличима от пройденной.
    globalSetup: ["src/blocks/data/testing/global-setup.ts"],
    // Внутри воркеров DATABASE_URL подменяется на тестовую базу: слой доступа
    // в тестах не должен попадать в рабочую базу разработчика.
    setupFiles: ["src/blocks/data/testing/setup-env.ts"],
    coverage: {
      provider: "v8",
      // Порог покрытия относительный (принципы проекта): абсолютного числа здесь нет,
      // приёмка сравнивает reports/coverage/coverage-summary.json с прошлым прогоном.
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "reports/coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**/layout.tsx"],
    },
  },
});
