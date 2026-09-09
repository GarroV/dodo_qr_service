// Что считается проваленным пунктом. Правило живёт в одном месте: и лента заполнений,
// и карточка считают провалы одинаково, иначе два экрана покажут разные числа.
import { severityOf } from "./severity";
import type { Answer, Item, Section } from "./types";

/** Все пункты снимка подряд: секции нужны на экране, а для счёта важны только пункты. */
export function flattenItems(sections: Section[]): Item[] {
  return sections.flatMap((section) => section.items);
}

/**
 * Пункт провален, если на него ответили и ответ отрицательный:
 * «нет» для да/нет, число вне заданного диапазона. Свободный текст провалить нельзя —
 * это описание, а не оценка. Пункт без ответа не провален: он просто не отвечен.
 */
export function isFailed(item: Item, answer: Answer | undefined): boolean {
  if (answer === undefined) return false;
  if (item.type === "bool") return answer.value === false;
  if (item.type === "number") {
    if (typeof answer.value !== "number") return false;
    if (item.min !== undefined && answer.value < item.min) return true;
    return item.max !== undefined && answer.value > item.max;
  }
  return false;
}

/** Сколько критичных пунктов провалено: это число видно в ленте (T045). */
export function countFailedCritical(
  snapshot: Section[],
  answers: Answer[],
): number {
  const byItem = new Map(answers.map((answer) => [answer.itemId, answer]));
  return flattenItems(snapshot).filter(
    (item) =>
      severityOf(item) === "critical" && isFailed(item, byItem.get(item.id)),
  ).length;
}
