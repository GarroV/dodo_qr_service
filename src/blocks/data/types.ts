// Формат разметки чек-листа и ответов. Это контракт между редактором и экраном
// заполнения (docs/forge/plan.md, «Контракты между блоками»): editor пишет, fill читает.

/** Текст на языках продукта: ключ — код языка ("ru", "en"). */
export type LocalizedText = Record<string, string>;

/** Тип ответа на пункт: да/нет, число с диапазоном, свободный текст. */
export type ItemType = "bool" | "number" | "text";

export interface Item {
  id: string;
  title: LocalizedText;
  type: ItemType;
  critical: boolean;
  min?: number;
  max?: number;
  hint?: LocalizedText;
}

/**
 * Секция — группа пунктов со своим заголовком (D012).
 * `source` показывает происхождение: свои пункты или вставка блока библиотеки (D011).
 * В опубликованной версии внутри всегда лежит снимок пунктов, а не ссылка на живой блок,
 * иначе правка блока меняла бы историю задним числом (принцип 3).
 */
export interface Section {
  id: string;
  title: LocalizedText;
  source: "own" | { blockId: string };
  items: Item[];
}

/** Ответ на пункт: значение по типу пункта, комментарий и момент ответа с устройства. */
export interface Answer {
  itemId: string;
  value: boolean | number | string;
  comment?: string;
  at: number;
}

/**
 * Состояние версии чек-листа.
 * `draft` — рабочий черновик методиста, `published` — та, что отдаётся на станцию,
 * `archived` — прежняя опубликованная. Содержимое версии не меняется никогда;
 * публикация следующей версии переводит прежнюю в `archived` и только.
 */
export type VersionStatus = "draft" | "published" | "archived";
