import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

import { PUBLIC_FILL_PREFIX, securityHeaders } from "./src/security-headers";

// Язык определяется по заголовку браузера в src/i18n/request.ts — без маршрутов вида /ru/… и без cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// В разработке Next собирает страницы на лету: горячая замена модулей ходит по вебсокету
// и выполняет код через eval. Продакшен-сборке ни то, ни другое не нужно, и там этого нет.
const isDevelopment = process.env.NODE_ENV === "development";

// «Любой путь, кроме начинающихся с /s/». Отрицательный просмотр вперёд — единственный
// способ выразить исключение в шаблоне пути Next; сегмент берётся из общей константы,
// чтобы переезд публичного маршрута не оставил здесь забытую строку.
const EVERYTHING_EXCEPT_PUBLIC_FILL = `/:path((?!${PUBLIC_FILL_PREFIX.slice(1)}).*)`;

/**
 * Сами заголовки и обоснование каждой строки политики — в `src/security-headers.ts`.
 * Здесь только развешивание: список один и тот же, ставится в двух местах.
 */
const nextConfig: NextConfig = {
  typedRoutes: true,
  // Next 16 иначе кладёт в корень свои AGENTS.md и CLAUDE.md — инструкции агентам ведём мы, не сборщик.
  agentRules: false,
  // На всё приложение целиком, КРОМЕ публичного маршрута заполнения: там политику
  // ставит `src/proxy.ts`, потому что она несёт одноразовый ключ, а ключ рождается
  // на запрос и статической настройке недоступен (T071). Исключение записано здесь,
  // а не «поверх»: два заголовка Content-Security-Policy на одном ответе браузер
  // применяет пересечением, и разбираться, что именно сработало, стало бы гаданием.
  headers: () => [
    {
      source: EVERYTHING_EXCEPT_PUBLIC_FILL,
      headers: securityHeaders({ isDevelopment }),
    },
  ],
};

export default withNextIntl(nextConfig);
