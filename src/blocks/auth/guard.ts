import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionSecret } from "./config";
import { LOGIN_PATH } from "./routes";
import {
  SESSION_COOKIE_NAME,
  readSessionToken,
  type AdminSession,
} from "./session";

async function currentSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined) return null;

  // Секрет читается только когда кука есть: без секрета проверить подпись нельзя,
  // и это отказ конфигурации — падаем, а не считаем куку годной.
  return readSessionToken(token, sessionSecret(), new Date());
}

/**
 * Требует сессию администратора. Без неё уводит на форму входа, бросая исключение
 * `redirect()` — управление в вызывающий код не возвращается и данные не рендерятся.
 *
 * Вызывается разметкой `src/app/admin/layout.tsx` для всех экранов админки сразу
 * и повторно — серверными действиями и обработчиками, которые меняют данные.
 */
export async function requireAdmin(): Promise<void> {
  if ((await currentSession()) === null) {
    redirect(LOGIN_PATH);
  }
}

/** Есть ли действующая сессия. Нужна форме входа, чтобы не показываться вошедшему. */
export async function hasAdminSession(): Promise<boolean> {
  return (await currentSession()) !== null;
}
