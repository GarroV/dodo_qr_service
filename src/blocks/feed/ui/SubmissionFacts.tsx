import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import { formatDuration } from "../format";
import type { SubmissionModel } from "../model";

/**
 * Полоса из четырёх фактов заполнения (эталон `.facts` в submission.html): когда
 * начато, когда отправлено, сколько заняло и сколько пунктов реально выполнено.
 * Числа уже посчитала модель (T046) — здесь только формат под экран, без счёта.
 *
 * Время показывается в поясе ПИЦЦЕРИИ (`model.timeZone`), а не сервера: сотрудник
 * видел на кухне местное время, и управляющий должен видеть то же самое.
 */

const CARD_CLASS =
  "bg-surface rounded-[var(--r-block)] border border-[var(--line-strong)] shadow-[var(--sh-xs)]";
const GRID_CLASS = "grid grid-cols-4";
const CELL_CLASS = "p-[var(--space-7)]";
const CELL_DIVIDED_CLASS = `${CELL_CLASS} border-l border-[var(--line)]`;
const VALUE_CLASS = "text-[length:var(--fs-title)] leading-[1.2] font-semibold";
const CAPTION_CLASS =
  "mt-[var(--space-2)] text-[length:var(--fs-meta)] text-[var(--ink-3)]";

interface FactProps {
  readonly value: string;
  readonly caption: string;
  readonly divided: boolean;
}

function Fact({ value, caption, divided }: FactProps): ReactElement {
  return (
    <div className={divided ? CELL_DIVIDED_CLASS : CELL_CLASS}>
      <div className={VALUE_CLASS}>{value}</div>
      <div className={CAPTION_CLASS}>{caption}</div>
    </div>
  );
}

export async function SubmissionFacts({
  model,
}: {
  readonly model: SubmissionModel;
}): Promise<ReactElement> {
  const t = await getTranslations("feed.card");
  const format = await getFormatter();

  const time = (at: Date): string =>
    format.dateTime(at, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: model.timeZone,
    });

  return (
    <div className={CARD_CLASS} data-testid="submission-facts">
      <div className={GRID_CLASS}>
        <Fact
          value={time(model.startedAt)}
          caption={t("startedAt")}
          divided={false}
        />
        <Fact
          value={time(model.submittedAt)}
          caption={t("submittedAt")}
          divided
        />
        <Fact
          value={formatDuration(model.durationMs)}
          caption={t("duration")}
          divided
        />
        <Fact
          value={t("doneValue", {
            done: model.doneCount,
            total: model.itemCount,
          })}
          caption={t("done")}
          divided
        />
      </div>
    </div>
  );
}
