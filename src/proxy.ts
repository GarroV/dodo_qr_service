import { NextResponse, type NextRequest } from "next/server";

import { sessionSecret } from "@/blocks/auth/config";
import { LOGIN_PATH } from "@/blocks/auth/routes";
import { SESSION_COOKIE_NAME, readSessionToken } from "@/blocks/auth/session";

/**
 * Первая преграда перед админкой: отказ выдаётся до того, как что-либо отрендерится.
 *
 * Почему одной охраны в `src/app/admin/layout.tsx` мало: разметка и страница рендерятся
 * параллельно, поэтому `redirect()` из разметки не отменяет рендер страницы — при запросе
 * клиентской навигации (заголовок `RSC`) её содержимое уезжало в теле ответа вместе с
 * редиректом. Найдено ревью безопасности, закрыто здесь, проверяется `e2e/admin-guard.spec.ts`.
 *
 * Охрана в разметке при этом остаётся: два независимых рубежа лучше одного,
 * и второй продолжает работать, даже если этот файл когда-нибудь потеряют.
 */
export const config = {
  // Только админка. Публичный маршрут заполнения `/s/*` сюда не попадает и о входе не знает.
  matcher: ["/admin/:path*"],
};

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Форма входа — единственный адрес под /admin, доступный без сессии.
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // Без секрета подписи проверить куку нечем: падаем, а не пускаем.
  const session =
    token === undefined
      ? null
      : readSessionToken(token, sessionSecret(), new Date());

  if (session !== null) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = LOGIN_PATH;
  // Запрошенный адрес в ссылку на вход не переносим: возвращать по параметру некуда,
  // а открытый редирект — это ровно та дыра, которую такой параметр обычно и приносит.
  target.search = "";

  return NextResponse.redirect(target, 307);
}
