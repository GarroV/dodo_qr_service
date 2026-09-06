// Итог заполнения одной строкой: что именно видно в столбце «Результат» ленты и меткой
// в шапке карточки. Здесь нет ни оценок скорости, ни признаков «поздно» и «вне зоны»
// (D003) — только факты: сколько пунктов провалено и сколько осталось без ответа.

export type Outcome =
  | { readonly kind: "ok" }
  | { readonly kind: "unanswered"; readonly count: number }
  | { readonly kind: "failed"; readonly count: number }
  | { readonly kind: "criticalFailed"; readonly count: number };

export interface OutcomeCounts {
  readonly itemCount: number;
  readonly answeredCount: number;
  readonly failedCount: number;
  readonly failedCriticalCount: number;
}

/**
 * Порядок важности: провал критичного пункта → провал обычного → пункт без ответа →
 * всё выполнено. Разбираться идут с самого тяжёлого, поэтому строка ленты называет
 * именно его; полная раскладка по пунктам — в карточке.
 *
 * «Всё выполнено» показывается, только когда провалов нет ВООБЩЕ: заполнение с
 * непройденным некритичным пунктом, названное успешным, — это ложь на главном экране.
 */
export function outcomeOf(counts: OutcomeCounts): Outcome {
  if (counts.failedCriticalCount > 0) {
    return { kind: "criticalFailed", count: counts.failedCriticalCount };
  }
  if (counts.failedCount > 0) {
    return { kind: "failed", count: counts.failedCount };
  }

  const unanswered = counts.itemCount - counts.answeredCount;
  if (unanswered > 0) return { kind: "unanswered", count: unanswered };

  return { kind: "ok" };
}
