// Разбор ошибок PostgreSQL в тестах: правила базы проверяются по коду ошибки
// (23505 — нарушение уникальности, 23514 — check, 23503 — внешний ключ),
// а не по тексту сообщения, который зависит от локали и версии сервера.
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate: unknown = (error as { code?: unknown }).code;
  if (typeof candidate === "string") return candidate;
  // Drizzle заворачивает ошибку драйвера: настоящий код лежит в cause.
  const cause: unknown = (error as { cause?: unknown }).cause;
  return cause === undefined ? undefined : codeOf(cause);
}

/**
 * Возвращает код ошибки PostgreSQL, если действие упало, и `undefined`, если прошло.
 * `undefined` в проверке означает «правило базы не сработало» — это провал теста.
 */
export async function dbErrorCode(
  action: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await action;
    return undefined;
  } catch (error) {
    return codeOf(error);
  }
}
