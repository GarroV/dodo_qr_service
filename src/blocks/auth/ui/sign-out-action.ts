"use server";

import { redirect } from "next/navigation";

import { redirectPath } from "@/blocks/core/base-path";

import { signOut } from "../actions";
import { LOGIN_PATH } from "../routes";

/** Действие кнопки «Выйти»: убирает куку и возвращает на форму входа. */
export async function submitSignOut(): Promise<void> {
  await signOut();
  redirect(redirectPath(LOGIN_PATH));
}
