// Тексты чек-листа многоязычны (D009): снимок хранит заголовок на всех языках, которые
// завёл методист. Экран показывает язык интерфейса, а если его нет — первый, который есть.
import type { LocalizedText } from "@/blocks/data";

/**
 * Пустая строка вместо `undefined`: пункт без заголовка на любом языке — это дефект
 * данных, но пустая строка на экране лучше слова «undefined» в ленте управляющего.
 */
export function pickText(
  text: LocalizedText | undefined,
  locale: string,
): string {
  if (text === undefined) return "";
  return text[locale] ?? Object.values(text)[0] ?? "";
}
