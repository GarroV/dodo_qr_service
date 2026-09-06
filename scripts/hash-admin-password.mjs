#!/usr/bin/env node
// Считает значение ADMIN_PASSWORD_HASH для .env.
//
//     node scripts/hash-admin-password.mjs        # ввести пароль, затем Ctrl-D
//     printf '%s' 'пароль' | node scripts/hash-admin-password.mjs
//
// Пароль читается из стандартного ввода, а не из аргумента команды: аргумент видно
// и в истории оболочки, и в списке процессов чужому пользователю машины.
// Сам пароль никуда не сохраняется — на выходе только хэш.
import { stdin, stdout, stderr, exit } from "node:process";

import { hashPassword } from "../src/blocks/auth/password.ts";

const MIN_PASSWORD_LENGTH = 12;

if (stdin.isTTY) {
  stderr.write("Пароль администратора (ввод виден на экране), затем Ctrl-D:\n");
}

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").trim();

if (password.length < MIN_PASSWORD_LENGTH) {
  stderr.write(
    `Пароль короче ${MIN_PASSWORD_LENGTH} знаков — вход в админку единственный, подбирать его будут долго только при длинном пароле.\n`,
  );
  exit(1);
}

stdout.write(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`);
