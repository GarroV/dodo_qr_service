import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import type { Outcome } from "../outcome";

/**
 * Метка итога заполнения. Одна на оба экрана: лента и карточка обязаны называть один
 * и тот же итог одними и теми же словами, а две копии этой таблицы соответствий
 * разъедутся на первой же правке словаря.
 *
 * Цвет несёт смысл, а не украшение: красный — провален критичный пункт, жёлтый —
 * есть непройденные или неотвеченные, зелёный — выполнено всё. Оценок поведения
 * сотрудника здесь нет и не будет (D003).
 */

const TAG_BASE =
  "inline-flex h-[20px] items-center gap-[var(--space-2)] rounded-[var(--r-mark)] border px-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] whitespace-nowrap uppercase";
const TAG_OK = `${TAG_BASE} border-[var(--ok-line)] bg-[var(--ok-soft)] text-[var(--ok)]`;
const TAG_WARN = `${TAG_BASE} border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn-ink)]`;
const TAG_ERR = `${TAG_BASE} border-[var(--err-line)] bg-[var(--err-soft)] text-[var(--err)]`;

const TAG_CLASS: Record<Outcome["kind"], string> = {
  ok: TAG_OK,
  unanswered: TAG_WARN,
  failed: TAG_WARN,
  criticalFailed: TAG_ERR,
};

export async function OutcomeTag({
  outcome,
}: {
  readonly outcome: Outcome;
}): Promise<ReactElement> {
  const t = await getTranslations("feed.outcome");

  return (
    <span
      className={TAG_CLASS[outcome.kind]}
      data-testid="outcome-tag"
      data-kind={outcome.kind}
    >
      {outcome.kind === "ok"
        ? t("ok")
        : t(outcome.kind, { count: outcome.count })}
    </span>
  );
}
