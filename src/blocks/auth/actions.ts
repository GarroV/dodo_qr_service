"use server";

import { cookies } from "next/headers";

import { adminPasswordHash, sessionSecret } from "./config";
import { verifyPassword } from "./password";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "./session";

const COOKIE_PATH = "/";

/**
 * Проверяет пароль и, если он верен, ставит сессионную куку на 30 дней.
 *
 * Возвращает `false` на неверный пароль — без подробностей о том, что именно не так:
 * учётная запись одна, и «нет такого пользователя» рассказывать некому.
 */
export async function signIn(password: string): Promise<boolean> {
  // Секрет подписи читается до проверки пароля: без него вход не может «получиться»
  // молча, без куки. Это отказ настройки площадки, а не неверный пароль.
  const secret = sessionSecret();

  const matches = await verifyPassword(password, adminPasswordHash());
  if (!matches) return false;

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(secret, new Date()), {
    // httpOnly: куку не достать из JavaScript, XSS не уносит сессию.
    httpOnly: true,
    // lax: форма входа отправляется со своего же сайта, межсайтовые запросы куку не носят.
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
    // На площадке — только по HTTPS. На localhost браузер считает соединение доверенным.
    secure: process.env.NODE_ENV === "production",
  });

  return true;
}

/** Завершает сессию: кука убирается, следующий запрос к `/admin/*` увидит форму входа. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE_NAME, path: COOKIE_PATH });
}
