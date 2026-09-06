// Значения живут только в окружении: в git попадает лишь .env.example с именами (принципы проекта).
const HASH_VARIABLE = "ADMIN_PASSWORD_HASH";
const SECRET_VARIABLE = "SESSION_SECRET";

// 32 знака ≈ 192 бита при base64: подпись сессии перестаёт быть подбираемой.
const MIN_SECRET_LENGTH = 32;

// Ни одно сообщение об ошибке не печатает значение переменной: они уезжают в логи сервера
// и в текст пятисотки, а это ровно те два места, где секрету быть нельзя.
function requiredVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `${name}: переменная окружения не задана, вход в админку невозможен. См. .env.example`,
    );
  }
  return value;
}

/** Хэш пароля единственного администратора. Сам пароль нигде не хранится. */
export function adminPasswordHash(): string {
  return requiredVariable(HASH_VARIABLE);
}

/** Секрет подписи сессионной куки. Разный на каждой площадке. */
export function sessionSecret(): string {
  const value = requiredVariable(SECRET_VARIABLE);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${SECRET_VARIABLE}: короче ${String(MIN_SECRET_LENGTH)} знаков — подпись сессии подбирается. Сгенерировать: openssl rand -base64 48`,
    );
  }
  return value;
}
