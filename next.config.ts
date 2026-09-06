import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Язык определяется по заголовку браузера в src/i18n/request.ts — без маршрутов вида /ru/… и без cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Next 16 иначе кладёт в корень свои AGENTS.md и CLAUDE.md — инструкции агентам ведём мы, не сборщик.
  agentRules: false,
};

export default withNextIntl(nextConfig);
