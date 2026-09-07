#!/usr/bin/env node
// Считает значение ADMIN_PASSWORD_HASH для .env.
//
//     node scripts/hash-admin-password.mjs        # ввести пароль, затем Ctrl-D
//     printf '%s' 'пароль' | node scripts/hash-admin-password.mjs
//
// Пароль читается из стандартного ввода, а не из аргумента команды: аргумент видно
// и в истории оболочки, и в списке процессов чужому пользователю машины.
// Сам пароль никуда не сохраняется — на выходе только хэш.
import { stdin, stdout, stderr, argv, exit } from "node:process";

import { hashPassword } from "../src/blocks/auth/password.ts";

const MIN_PASSWORD_LENGTH = 12;

// Порог остаётся по умолчанию, но перестаёт быть непреодолимым: владелец вправе
// поставить короткий пароль на время показа (D047), и такое решение должно
// оформляться явным флагом, а не обходом скрипта одноразовым кодом на стороне.
// Молчаливого пути к короткому паролю здесь нет: с флагом печатается предупреждение.
const ALLOW_SHORT_FLAG = "--allow-short";

const args = argv.slice(2);
const unknown = args.filter((arg) => arg !== ALLOW_SHORT_FLAG);
if (unknown.length > 0) {
  // Проглоченный аргумент выглядел бы как успех: пароль захэширован, а флаг не сработал.
  stderr.write(
    `Неизвестные аргументы: ${unknown.join(" ")}. Допустим только ${ALLOW_SHORT_FLAG}.\n`,
  );
  exit(2);
}
const allowShort = args.includes(ALLOW_SHORT_FLAG);

if (stdin.isTTY) {
  stderr.write("Пароль администратора (ввод виден на экране), затем Ctrl-D:\n");
}

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").trim();

if (password.length === 0) {
  stderr.write("Пароль пустой — хэшировать нечего.\n");
  exit(1);
}

if (password.length < MIN_PASSWORD_LENGTH) {
  if (!allowShort) {
    stderr.write(
      `Пароль короче ${MIN_PASSWORD_LENGTH} знаков — вход в админку единственный, подбирать его будут долго только при длинном пароле.\n` +
        `Если короткий пароль — осознанное решение (показ, локальная копия), повторите с ${ALLOW_SHORT_FLAG}.\n`,
    );
    exit(1);
  }
  stderr.write(
    `ВНИМАНИЕ: пароль короче ${MIN_PASSWORD_LENGTH} знаков и открывает единственный вход в кабинет.\n` +
      `Пока продукт доступен из интернета, такой пароль подбирается за минуты — годится только на время показа.\n`,
  );
}

stdout.write(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`);
