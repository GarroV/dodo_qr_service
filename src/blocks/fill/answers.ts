// Правила экрана заполнения: что считается отвеченным пунктом, сколько осталось,
// когда открывается кнопка отправки и что уходит на сервер.
//
// Чистые функции без разметки: то же самое считает и браузер (кнопка и прогресс),
// и сервер (проверка перед записью). Два разных счёта означали бы, что экран
// разрешает то, что сервер отвергнет, — или наоборот.
import type { Answer, Item, Section } from "@/blocks/data";
import { flattenItems, isFailed } from "@/blocks/data";

/** Ответ в работе: значение ещё может отсутствовать, комментарий — быть пустым. */
export interface DraftAnswer {
  readonly value: boolean | number | string | null;
  readonly comment: string;
  /** Момент ответа с устройства сотрудника. */
  readonly at: number;
}

export type FillDraft = Readonly<Record<string, DraftAnswer>>;

export function emptyDraft(): FillDraft {
  return {};
}

export interface FillSummary {
  readonly total: number;
  readonly answered: number;
  readonly remaining: number;
  /** Пункты с отрицательным ответом: «нет» или число вне диапазона. */
  readonly failedItemIds: readonly string[];
  /** Проваленные критичные пункты, у которых ещё нет комментария (D018). */
  readonly needsCommentItemIds: readonly string[];
  readonly canSubmit: boolean;
}

/**
 * Пункт отвечен, когда на нём есть значение своего типа.
 * «Нет» — такой же полноценный ответ, как «да»: сотрудник сообщил, что не выполнено.
 * Текст без букв (одни пробелы) ответом не считается — это несделанный пункт.
 */
export function isAnswered(
  item: Item,
  draft: DraftAnswer | undefined,
): boolean {
  if (draft === undefined || draft.value === null) return false;
  if (item.type === "bool") return typeof draft.value === "boolean";
  if (item.type === "number") {
    return typeof draft.value === "number" && Number.isFinite(draft.value);
  }
  return typeof draft.value === "string" && draft.value.trim() !== "";
}

/** Ответ в том виде, в каком его понимает общий счёт провалов блока `data`. */
function toAnswer(itemId: string, draft: DraftAnswer): Answer {
  const comment = draft.comment.trim();
  const value = draft.value ?? "";
  return comment === ""
    ? { itemId, value, at: draft.at }
    : { itemId, value, comment, at: draft.at };
}

/**
 * Что показывает шкала и что написано на кнопке.
 *
 * Провал считается тем же правилом, что лента и карточка заполнения
 * (`isFailed` блока `data`): иначе экран сотрудника и экран управляющего
 * разошлись бы в том, что считать невыполненным.
 */
export function summarizeFill(
  sections: readonly Section[],
  draft: FillDraft,
): FillSummary {
  const items = flattenItems([...sections]);
  const failedItemIds: string[] = [];
  const needsCommentItemIds: string[] = [];
  let answered = 0;

  for (const item of items) {
    const entry = draft[item.id];
    if (!isAnswered(item, entry) || entry === undefined) continue;
    answered += 1;

    if (!isFailed(item, toAnswer(item.id, entry))) continue;
    failedItemIds.push(item.id);
    if (item.critical && entry.comment.trim() === "") {
      needsCommentItemIds.push(item.id);
    }
  }

  const remaining = items.length - answered;
  return {
    total: items.length,
    answered,
    remaining,
    failedItemIds,
    needsCommentItemIds,
    // Пустой чек-лист отправлять нечем: отправка нуля ответов — не заполнение.
    canSubmit:
      items.length > 0 && remaining === 0 && needsCommentItemIds.length === 0,
  };
}

/** Попадание числа в диапазон — подпись под полем, а не запрет (критерий 4). */
export function rangeVerdict(
  item: Item,
  value: number | null,
): "within" | "outside" | "unbounded" {
  if (item.type !== "number" || typeof value !== "number") return "unbounded";
  if (item.min === undefined && item.max === undefined) return "unbounded";
  const belowMin = item.min !== undefined && value < item.min;
  const aboveMax = item.max !== undefined && value > item.max;
  return belowMin || aboveMax ? "outside" : "within";
}

/**
 * Ответы для записи: только отвеченные пункты и только те, что есть в чек-листе,
 * в порядке самого чек-листа. Комментарий уходит непустой и без крайних пробелов.
 */
export function toAnswers(
  sections: readonly Section[],
  draft: FillDraft,
): Answer[] {
  const answers: Answer[] = [];
  for (const item of flattenItems([...sections])) {
    const entry = draft[item.id];
    if (entry === undefined || !isAnswered(item, entry)) continue;
    answers.push(toAnswer(item.id, entry));
  }
  return answers;
}
