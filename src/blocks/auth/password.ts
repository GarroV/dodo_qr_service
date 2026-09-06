import { Buffer } from "node:buffer";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Параметры scrypt. Хранятся в самой строке хэша: сменить их можно, не ломая старые. */
export interface ScryptParams {
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelization: number;
}

/** N = 2^15, r = 8, p = 1 — рекомендация OWASP; на входе в админку это ~0,1 с. */
const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  cost: 32_768,
  blockSize: 8,
  parallelization: 1,
};

const ALGORITHM = "scrypt";
const SEPARATOR = "$";
const HASH_PARTS = 6;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const ENCODING = "base64url";
const ENV_NAME = "ADMIN_PASSWORD_HASH";

interface StoredHash {
  readonly params: ScryptParams;
  readonly salt: Buffer;
  readonly key: Buffer;
}

/**
 * Ошибка про испорченный хэш. В сообщении только имя переменной окружения:
 * ни пароль, ни хэш не должны утечь в лог сервера или в ответ браузеру.
 */
function invalidHash(reason: string): Error {
  return new Error(
    `${ENV_NAME}: ${reason}. Сгенерировать заново: node scripts/hash-admin-password.mjs`,
  );
}

// scrypt требует 128 · N · r байт памяти. Запас вдвое: иначе рабочие параметры
// упираются во встроенный лимит Node в 32 МБ и падают вместо проверки пароля.
function memoryLimit(params: ScryptParams): number {
  return 2 * 128 * params.cost * params.blockSize;
}

async function derive(
  password: string,
  salt: Buffer,
  params: ScryptParams,
  keyLength: number,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      // Нормализация Unicode: один и тот же пароль с разной раскладкой composed/decomposed
      // иначе даёт разные ключи на разных клавиатурах.
      password.normalize("NFKC"),
      salt,
      keyLength,
      {
        N: params.cost,
        r: params.blockSize,
        p: params.parallelization,
        maxmem: memoryLimit(params),
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

function parsePositiveInteger(raw: string | undefined, field: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidHash(`параметр ${field} не целое положительное число`);
  }
  return value;
}

function parseStored(stored: string): StoredHash {
  const parts = stored.split(SEPARATOR);
  if (parts.length !== HASH_PARTS || parts[0] !== ALGORITHM) {
    throw invalidHash(
      `ожидается строка вида scrypt${SEPARATOR}N${SEPARATOR}r${SEPARATOR}p${SEPARATOR}соль${SEPARATOR}ключ`,
    );
  }

  const salt = Buffer.from(parts[4] ?? "", ENCODING);
  const key = Buffer.from(parts[5] ?? "", ENCODING);
  if (salt.length !== SALT_LENGTH || key.length !== KEY_LENGTH) {
    throw invalidHash("соль или ключ не той длины");
  }

  return {
    params: {
      cost: parsePositiveInteger(parts[1], "N"),
      blockSize: parsePositiveInteger(parts[2], "r"),
      parallelization: parsePositiveInteger(parts[3], "p"),
    },
    salt,
    key,
  };
}

/** Считает хэш пароля для `ADMIN_PASSWORD_HASH`. Соль случайная на каждый вызов. */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params, KEY_LENGTH);

  return [
    ALGORITHM,
    params.cost,
    params.blockSize,
    params.parallelization,
    salt.toString(ENCODING),
    key.toString(ENCODING),
  ].join(SEPARATOR);
}

/**
 * Проверяет пароль против хранимого хэша.
 *
 * Время ответа не зависит от того, верен пароль или нет: вычисление scrypt идёт всегда
 * целиком, а сравнение ключей — `timingSafeEqual`, без выхода на первом отличии.
 * Длины ключей совпадают по построению, поэтому раннего выхода по длине тоже нет.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const { params, salt, key } = parseStored(stored);
  const derived = await derive(password, salt, params, key.length);

  return timingSafeEqual(derived, key);
}
