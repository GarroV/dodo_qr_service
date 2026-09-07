"use server";

import { redirect } from "next/navigation";

import { signOut } from "../actions";
import { LOGIN_PATH } from "../routes";

/** Действие кнопки «Выйти»: убирает куку и возвращает на форму входа. */
export async function submitSignOut(): Promise<void> {
  await signOut();
  redirect(LOGIN_PATH);
}
