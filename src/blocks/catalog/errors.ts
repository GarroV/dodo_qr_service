// Отказы справочника в виде, который доходит до человека. Правила целостности живут
// в базе (`on delete restrict` на историю заполнений), и без такого перевода методист
// вместо «на пиццерию ссылаются заполнения» видел бы пятисотку и белый экран.

/**
 * Причина отказа. Код — он же ключ словаря (`catalog.errors.<код>`): один и тот же
 * набор значений в коде и в переводах, поэтому забытый текст виден типами, а не глазом.
 */
export const CATALOG_ERROR_CODES = [
  "nameRequired",
  "localeNotSupported",
  "unknownTimezone",
  "referencedByHistory",
  "countryNotEmpty",
  "confirmationRequired",
  "notFound",
  "codeCollision",
] as const;

export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];

const CODES = new Set<string>(CATALOG_ERROR_CODES);

/** Пришёл ли код отказа из этого набора. Нужен на границе: адрес правит кто угодно. */
export function isCatalogErrorCode(value: unknown): value is CatalogErrorCode {
  return typeof value === "string" && CODES.has(value);
}

/**
 * Отказ справочника. Сообщение — для журнала сервера и разработчика; на экран идёт
 * перевод по `code`, потому что текст исключения на кухне и в админке разный.
 */
export class CatalogError extends Error {
  readonly code: CatalogErrorCode;

  constructor(code: CatalogErrorCode, message: string) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
  }
}

/** Нарушение внешнего ключа: на строку ссылаются, поэтому база не даёт её удалить. */
export const PG_FOREIGN_KEY_VIOLATION = "23503";
/** Нарушение уникальности: например, код станции уже занят другой станцией. */
export const PG_UNIQUE_VIOLATION = "23505";

/**
 * Код ошибки PostgreSQL, если он есть. Drizzle заворачивает ошибку драйвера,
 * поэтому настоящий код может лежать в `cause` — ищем по цепочке.
 */
export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  // У нашего собственного отказа поле `code` тоже есть, и принять его за код
  // PostgreSQL значило бы разбирать чужую ошибку вслепую.
  if (error instanceof CatalogError) return undefined;

  const code: unknown = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;

  const cause: unknown = (error as { cause?: unknown }).cause;
  return cause === undefined ? undefined : pgErrorCode(cause);
}

/**
 * Переводит запрет удаления в понятный отказ. Всё остальное пробрасывает как есть:
 * проглоченная неизвестная ошибка — это молчаливый сбой, а не забота о пользователе.
 */
export function asHistoryConflict(error: unknown, what: string): never {
  if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
    throw new CatalogError(
      "referencedByHistory",
      `${what}: на строку ссылаются заполнения, история неприкосновенна`,
    );
  }
  throw error;
}

/** Непустое имя после обрезки пробелов. Пустое имя делает строку справочника безымянной. */
export function requireName(name: string, what: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new CatalogError("nameRequired", `${what}: имя обязательно`);
  }
  return trimmed;
}
