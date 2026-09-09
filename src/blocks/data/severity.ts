// Уровень пункта и режим смены: что из чек-листа попадает на экран сегодня.
//
// Матрица «режим → уровни» зашита здесь и больше нигде (D056): справочника режимов
// нет, настраивать нечего, и при появлении пространств стран (D050) переливать тоже
// нечего — перечисление живёт в коде, а не в таблице.
import type { Item, Section, Severity, ShiftMode } from "./types";

/** Уровни, попадающие на экран в каждом режиме. Порядок — от тяжёлого к лёгкому. */
const MODE_SEVERITIES: Readonly<Record<ShiftMode, readonly Severity[]>> = {
  normal: ["critical", "major", "normal"],
  reduced: ["critical", "major"],
  critical: ["critical"],
};

const SHIFT_MODES = Object.keys(MODE_SEVERITIES) as readonly ShiftMode[];

/**
 * Уровень пункта — с чтением старого признака `critical`.
 *
 * Пункты живут внутри JSONB (`checklist_versions.sections`, `submissions.snapshot`),
 * то есть в замороженных документах, переписывать которые нельзя (принцип 3, D002).
 * Поэтому уровень не мигрируется, а выводится при чтении: версии, опубликованные до
 * появления уровней, продолжают читаться правильно вечно. Уровня «важный» в старых
 * данных не возникает — решать задним числом за методиста, что у него было важным,
 * мы не будем.
 */
export function severityOf(item: Item): Severity {
  if (item.severity !== undefined) return item.severity;
  // Единственное место в продукте, которое читает устаревшее поле, — и обязано его
  // читать: иначе версии, опубликованные до появления уровней, стали бы обычными,
  // а критичные пункты в них молча перестали бы требовать объяснения провала.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- разбор старых данных, см. выше
  return item.critical === true ? "critical" : "normal";
}

const SEVERITIES: readonly Severity[] = ["critical", "major", "normal"];

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && SEVERITIES.includes(value as Severity);
}

export function isShiftMode(value: unknown): value is ShiftMode {
  return typeof value === "string" && SHIFT_MODES.includes(value as ShiftMode);
}

export function isItemInMode(item: Item, mode: ShiftMode): boolean {
  return MODE_SEVERITIES[mode].includes(severityOf(item));
}

/**
 * Чек-лист, каким его видит сотрудник в этом режиме. Секция, из которой выпали все
 * пункты, не остаётся пустым заголовком, а исчезает целиком.
 *
 * Возвращает новые объекты и не трогает исходные: те же секции показываются
 * управляющему в ленте в полном виде, и порча их фильтрацией стёрла бы факт
 * сокращения ровно там, где его и надо видеть.
 */
export function sectionsForMode(
  sections: readonly Section[],
  mode: ShiftMode,
): Section[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isItemInMode(item, mode)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Провал этого пункта сотрудник обязан объяснить словами.
 *
 * Раньше объяснения требовал только критичный пункт, потому что уровней было два.
 * С появлением «важного» правило поднимается и на него: пересчитанная касса и
 * выключенная вытяжка — это деньги, и «не выполнено» без единого слова о причине
 * не даёт управляющему ничего, кроме тревоги без предмета. Обычный пункт остаётся
 * без принуждения: заставлять писать объяснение о непротёртом столе — способ
 * научить людей писать «ок» в каждое поле.
 */
export function requiresCommentOnFailure(item: Item): boolean {
  const severity = severityOf(item);
  return severity === "critical" || severity === "major";
}
