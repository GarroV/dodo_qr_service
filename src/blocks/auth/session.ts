import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Имя сессионной куки. Одно на весь продукт: аккаунт в MVP один (D014). */
export const SESSION_COOKIE_NAME = "dodo_qr_admin";

/** Срок жизни сессии — 30 дней по контракту блока. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const PAYLOAD_VERSION = 1;
const SEPARATOR = ".";
const ENCODING = "base64url";
const MILLISECONDS = 1000;

/** Сессия администратора. Ни имени, ни роли: в MVP аккаунт один и прав у него все. */
export interface AdminSession {
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

interface Payload {
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest(ENCODING);
}

// Сравнение подписей постоянного времени. Длины HMAC совпадают всегда, кроме случая,
// когда подпись в куке подделана — там разная длина сама по себе означает отказ.
function signaturesMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, ENCODING);
  const right = Buffer.from(actual, ENCODING);

  return left.length === right.length && timingSafeEqual(left, right);
}

function parsePayload(encoded: string): Payload | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, ENCODING).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof decoded !== "object" || decoded === null) return null;
  const { v, iat, exp } = decoded as Record<string, unknown>;
  if (
    v !== PAYLOAD_VERSION ||
    typeof iat !== "number" ||
    typeof exp !== "number"
  ) {
    return null;
  }

  return { issuedAt: iat, expiresAt: exp };
}

/**
 * Собирает значение сессионной куки: содержимое и подпись HMAC-SHA256 на `SESSION_SECRET`.
 * Внутри только отметки времени — ни пароля, ни секрета, ни персональных данных.
 */
export function createSessionToken(secret: string, now: Date): string {
  const issuedAt = Math.floor(now.getTime() / MILLISECONDS);
  const payload = Buffer.from(
    JSON.stringify({
      v: PAYLOAD_VERSION,
      iat: issuedAt,
      exp: issuedAt + SESSION_MAX_AGE_SECONDS,
    }),
  ).toString(ENCODING);

  return `${payload}${SEPARATOR}${sign(payload, secret)}`;
}

/**
 * Разбирает куку. Возвращает сессию, только если подпись сходится и срок не истёк;
 * во всех остальных случаях — null, без исключений: мусор в куке приходит из интернета.
 */
export function readSessionToken(
  token: string,
  secret: string,
  now: Date,
): AdminSession | null {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  if (!signaturesMatch(sign(payload, secret), signature)) return null;

  const parsed = parsePayload(payload);
  if (parsed === null) return null;

  const expiresAt = new Date(parsed.expiresAt * MILLISECONDS);
  if (now.getTime() >= expiresAt.getTime()) return null;

  return { issuedAt: new Date(parsed.issuedAt * MILLISECONDS), expiresAt };
}
