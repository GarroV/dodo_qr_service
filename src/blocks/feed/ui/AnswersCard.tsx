import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import type {
  AnswerView,
  SubmissionItemView,
  SubmissionModel,
  SubmissionSectionView,
} from "../model";

/**
 * Карточка «Ответы» (эталон `.sec-cap`/`.answer` в submission.html): секции и пункты
 * ровно в том виде, в котором их видел сотрудник (D002) — заголовок и диапазон из
 * СНИМКА чек-листа, ответ и время из заполнения.
 *
 * Разметка не решает, что провалено и что выполнено: это уже решила модель
 * (`item.failed`, `item.answer.kind`) — здесь только цвет и текст по готовым флагам.
 */

const CARD_CLASS =
  "bg-surface rounded-[var(--r-block)] border border-[var(--line-strong)] shadow-[var(--sh-xs)]";
const HEAD_CLASS =
  "flex items-center gap-[var(--space-6)] rounded-t-[var(--r-block)] border-b border-[var(--line)] bg-[var(--surface-3)] px-[var(--space-7)] py-[var(--space-6)]";
const TITLE_CLASS =
  "text-[length:var(--fs-title)] leading-[var(--lh-title)] font-semibold";

const SEC_CAP_CLASS =
  "flex items-center gap-[var(--space-4)] border-b border-[var(--line)] bg-[var(--surface-2)] px-[var(--space-7)] pt-[var(--space-6)] pb-[var(--space-3)] text-[length:var(--fs-micro)] leading-[var(--lh-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";

const TAG_BASE_CLASS =
  "inline-flex h-[20px] items-center gap-[var(--space-2)] rounded-[var(--r-mark)] border px-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] whitespace-nowrap uppercase";
const CRIT_TAG_CLASS = `${TAG_BASE_CLASS} border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn-ink)]`;
const LIBRARY_TAG_CLASS = `${TAG_BASE_CLASS} border-[var(--reg-supp-line)] bg-[var(--reg-supp-soft)] text-[var(--reg-supp)]`;

const ROW_CLASS =
  "grid items-center gap-[var(--space-6)] px-[var(--space-7)] py-[var(--space-5)]";
const ROW_GRID_STYLE = { gridTemplateColumns: "24px 1fr auto auto" } as const;
const ROW_BORDER_CLASS = "border-b border-[var(--line)]";

const MARK_BASE_CLASS =
  "h-[18px] w-[18px] rounded-[var(--r-mark)] border-[1.5px]";
const MARK_NONE_CLASS = `${MARK_BASE_CLASS} border-[var(--line-control-2)]`;
const MARK_OK_CLASS = `${MARK_BASE_CLASS} border-[var(--ok)] bg-[var(--ok)]`;
const MARK_FAIL_CLASS = `${MARK_BASE_CLASS} border-[var(--err)] bg-[var(--err)]`;

const TITLE_ROW_CLASS = "flex flex-wrap items-center gap-[var(--space-3)]";
const HINT_CLASS = "text-[length:var(--fs-meta)] text-[var(--ink-3)]";
const VALUE_CLASS =
  "font-[family-name:var(--font-num)] text-[length:var(--fs-num)] whitespace-nowrap";
const TIME_CLASS =
  "font-[family-name:var(--font-num)] text-[length:var(--fs-num)] text-[var(--ink-3)] whitespace-nowrap";

const COMMENT_CLASS =
  "mt-[var(--space-4)] rounded-[var(--r-block)] border border-[var(--err-line)] bg-[var(--err-soft)] px-[var(--space-6)] py-[var(--space-5)] text-[length:var(--fs-dense)]";
const COMMENT_STYLE = { gridColumn: "2 / -1" } as const;

type Formatter = Awaited<ReturnType<typeof getFormatter>>;
type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Заливка квадратика: провал красным перекрывает всё остальное, пункт без ответа
 * остаётся пустым с серой рамкой — его нельзя перепутать с выполненным, — а
 * зелёным закрашен только отвеченный и не проваленный пункт.
 */
function markClass(item: SubmissionItemView): string {
  if (item.failed) return MARK_FAIL_CLASS;
  if (item.answer.kind === "none") return MARK_NONE_CLASS;
  return MARK_OK_CLASS;
}

/**
 * Пояснение рядом с заголовком — ОДНО, а не два.
 *
 * Подсказка методиста побеждает посчитанный диапазон: в живых чек-листах она его и
 * повторяет («160–180 °C» при min 160 и max 180), и рядом это читается как «160–180
 * 160–180 °C» — найдено сверкой живого экрана с эталоном, где пояснение одно.
 * Диапазон остаётся запасным вариантом: пункт с границами, но без подсказки, обязан
 * показать, чего от сотрудника ждали.
 */
function noteText(item: SubmissionItemView, t: Translate): string | null {
  if (item.hint !== null) return item.hint;
  if (item.min !== null && item.max !== null) {
    return t("range", { min: item.min, max: item.max });
  }
  if (item.min !== null) return t("rangeMin", { min: item.min });
  if (item.max !== null) return t("rangeMax", { max: item.max });
  return null;
}

/** Значение ответа в его собственном виде: да/нет, число, текст или «без ответа». */
function valueText(answer: AnswerView, t: Translate): string {
  if (answer.kind === "bool") return answer.value ? t("yes") : t("no");
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "text") return answer.value;
  return t("noAnswer");
}

/** Неотвеченный пункт подсвечен тем же серым, что и его квадратик, а не обычным цветом. */
function valueColor(item: SubmissionItemView): string | undefined {
  if (item.failed) return "var(--err)";
  if (item.answer.kind === "none") return "var(--ink-3)";
  return undefined;
}

function AnswerRow({
  item,
  isLast,
  format,
  t,
  timeZone,
}: {
  readonly item: SubmissionItemView;
  readonly isLast: boolean;
  readonly format: Formatter;
  readonly t: Translate;
  readonly timeZone: string;
}): ReactElement {
  const note = noteText(item, t);
  const color = valueColor(item);

  return (
    <div
      className={isLast ? ROW_CLASS : `${ROW_CLASS} ${ROW_BORDER_CLASS}`}
      style={ROW_GRID_STYLE}
      data-testid="answer-row"
      data-item-id={item.itemId}
      data-failed={String(item.failed)}
    >
      <span className={markClass(item)} />
      <span className={TITLE_ROW_CLASS}>
        <span>{item.title}</span>
        {item.critical ? (
          <span className={CRIT_TAG_CLASS}>{t("critical")}</span>
        ) : null}
        {note === null ? null : <span className={HINT_CLASS}>{note}</span>}
      </span>
      <span
        className={VALUE_CLASS}
        style={color === undefined ? undefined : { color }}
      >
        {valueText(item.answer, t)}
      </span>
      <span className={TIME_CLASS}>
        {item.answeredAt === null
          ? "—"
          : format.dateTime(item.answeredAt, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone,
            })}
      </span>
      {item.comment === null ? null : (
        <div
          className={COMMENT_CLASS}
          style={COMMENT_STYLE}
          data-testid="answer-comment"
        >
          {item.comment}
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  section,
  isLastSection,
  format,
  t,
  timeZone,
}: {
  readonly section: SubmissionSectionView;
  readonly isLastSection: boolean;
  readonly format: Formatter;
  readonly t: Translate;
  readonly timeZone: string;
}): ReactElement {
  return (
    <div>
      <div className={SEC_CAP_CLASS} data-testid="answer-section">
        <span>{section.title}</span>
        {section.fromLibrary ? (
          <span className={LIBRARY_TAG_CLASS}>{t("libraryBlock")}</span>
        ) : null}
      </div>
      {section.items.map((item, itemIndex) => (
        <AnswerRow
          key={item.itemId}
          item={item}
          isLast={isLastSection && itemIndex === section.items.length - 1}
          format={format}
          t={t}
          timeZone={timeZone}
        />
      ))}
    </div>
  );
}

export async function AnswersCard({
  model,
}: {
  readonly model: SubmissionModel;
}): Promise<ReactElement> {
  const t = await getTranslations("feed.card");
  const format = await getFormatter();
  const lastSectionIndex = model.sections.length - 1;

  return (
    <div className={CARD_CLASS} data-testid="answers-card">
      <div className={HEAD_CLASS}>
        <h2 className={TITLE_CLASS}>{t("answers")}</h2>
      </div>
      <div>
        {model.sections.map((section, sectionIndex) => (
          <SectionBlock
            key={section.id}
            section={section}
            isLastSection={sectionIndex === lastSectionIndex}
            format={format}
            t={t}
            timeZone={model.timeZone}
          />
        ))}
      </div>
    </div>
  );
}
