"use server";

import { redirect } from "next/navigation";

import { signIn } from "../actions";
import { ADMIN_HOME_PATH } from "../routes";

/** Длиннее человек не набирает; ограничение отсекает попытку загрузить в поле мегабайт. */
const MAX_PASSWORD_LENGTH = 512;

export interface LoginFormState {
  readonly failed: boolean;
}

/**
 * Действие формы входа. Разбирает поле, отдаёт пароль блоку и на успехе уводит в админку.
 *
 * Причина отказа наружу не выносится: и «поле пустое», и «пароль не тот» выглядят одинаково.
 */
export async function submitLogin(
  previous: LoginFormState,
  form: FormData,
): Promise<LoginFormState> {
  void previous;
  const password = form.get("password");

  // Проверка на границе системы: из браузера в поле формы приходит что угодно, включая файл.
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return { failed: true };
  }

  if (await signIn(password)) {
    redirect(ADMIN_HOME_PATH);
  }

  return { failed: true };
}
