// Адреса блока. Собраны в одном месте: разметка, сквозные сценарии и охрана админки
// ссылаются на строку отсюда, а не на свою копию.

/** Лента заполнений. */
export const FEED_PATH = "/admin/feed";

/** Карточка одного заполнения. */
export function submissionPath(id: string): string {
  return `${FEED_PATH}/${encodeURIComponent(id)}`;
}
