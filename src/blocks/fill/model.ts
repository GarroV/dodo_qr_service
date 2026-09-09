// Что видит экран заполнения. Тексты здесь уже выбраны по языку и склеены:
// разметке остаётся только показать строки, а вся работа с языками и формат
// подсказок живут в одном месте (`view.ts`) и проверяются модульными тестами.
import type { ItemType, Severity } from "@/blocks/data";

export interface FillItemView {
  readonly id: string;
  readonly title: string;
  readonly type: ItemType;
  readonly severity: Severity;
  readonly min?: number;
  readonly max?: number;
  /** Подсказка методиста и диапазон одной строкой; `null` — строки нет. */
  readonly hint: string | null;
}

export interface FillSectionView {
  readonly id: string;
  readonly title: string;
  readonly items: readonly FillItemView[];
}

export interface FillScreenView {
  readonly checklistTitle: string;
  /** «Пиццерия · Станция · 06:00–12:00» — вторая строка шапки эталона. */
  readonly where: string;
  readonly sections: readonly FillSectionView[];
  readonly totalItems: number;
}

/** Подписи диапазона: приходят из словаря, чтобы `view.ts` не знал о next-intl. */
export interface FillViewLabels {
  readonly range: (min: number, max: number) => string;
  readonly rangeFrom: (min: number) => string;
  readonly rangeTo: (max: number) => string;
}
