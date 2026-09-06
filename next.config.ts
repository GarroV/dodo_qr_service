import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Язык определяется по заголовку браузера в src/i18n/request.ts — без маршрутов вида /ru/… и без cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// В разработке Next собирает страницы на лету: горячая замена модулей ходит по вебсокету
// и выполняет код через eval. Продакшен-сборке ни то, ни другое не нужно, и там этого нет.
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Политика подобрана прогоном на настоящем браузере (`e2e/security-headers.spec.ts`),
 * а не по памяти. Что показал прогон на продакшен-сборке:
 *
 * - `style-src 'self'` проходит: Tailwind 4 и `next/font` в сборке отдают связанный файл
 *   стилей, а не тег `<style>`. `'unsafe-inline'` всё же оставлен — атрибут `style`
 *   у React встречается на каждом втором экране (ширина шкалы, отступ по данным), и
 *   политика, которая ломает следующий же экран, будет снята целиком, а не ослаблена.
 * - `script-src` без `'unsafe-inline'` ломает приложение: Next кладёт полезную нагрузку
 *   RSC инлайновым `<script>`, и браузер отбивает его (`script-src-elem inline`).
 *   Строгий вариант — одноразовый `nonce` на запрос, а его выдаёт `proxy.ts`, который
 *   сейчас принадлежит блоку auth и включён только на `/admin/*`. Это отдельная задача,
 *   а не побочная правка блока core.
 * - `img-src` с `data:` нужен QR-кодам: эталон рисует их как `data:image/svg` (`states.html`).
 * - `font-src 'self'` — шрифты раздаёт само приложение (T064), сторонний домен не нужен.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws:" : ""}`,
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // То же, что frame-ancestors, для браузеров, которые его не знают. Публичный маршрут
  // заполнения уйдёт в интернет по ссылке из QR — во фрейме его быть не должно нигде.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Камера в продукте не нужна: QR-наклейку читает камера телефона снаружи браузера,
  // а не страница. Появится сканер прямо на экране — эту строку придётся ослабить осознанно.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Next 16 иначе кладёт в корень свои AGENTS.md и CLAUDE.md — инструкции агентам ведём мы, не сборщик.
  agentRules: false,
  // На всё приложение целиком, включая публичный маршрут заполнения и статику:
  // список исключений разъезжается с продуктом, а «по умолчанию защищено» — нет.
  headers: () => [{ source: "/:path*", headers: securityHeaders }],
};

export default withNextIntl(nextConfig);
