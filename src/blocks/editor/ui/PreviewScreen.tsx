import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import type { Item, LocalizedText, Section } from "@/blocks/data";

import { loadEditor } from "../drafts";
import { checklistPath } from "../routes";

/**
 * Предпросмотр «как это увидит сотрудник» — та же разметка, что первый телефон
 * эталона `docs/forge/design/screens/fill.html` (класс `.fill`), но данные берутся
 * из живого черновика, а не из ответов сотрудника. Экран только для чтения:
 * ни одного обработчика, сохранение ответов появится вместе с блоком `fill` —
 * до тех пор это временный вид, и плашка сверху говорит об этом прямо.
 */

type Translate = Awaited<ReturnType<typeof getTranslations>>;

const NOTICE_CLASS =
  "flex items-center gap-[var(--space-5)] rounded-[var(--r-block)] border border-[var(--line-strong)] bg-[var(--surface-2)] px-[var(--space-7)] py-[var(--space-6)] text-[length:var(--fs-dense)]";
const CARD_CLASS =
  "mx-auto my-[var(--space-8)] flex max-w-[420px] flex-col overflow-hidden rounded-[var(--r-screen)] border border-[var(--line-strong)] bg-surface shadow-[var(--sh-xs)]";
const HEADER_CLASS =
  "border-b border-[var(--line-strong)] px-[var(--space-7)] pt-[var(--space-7)] pb-[var(--space-6)]";
const SECTION_TITLE_CLASS =
  "px-[var(--space-7)] pt-[var(--space-8)] pb-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";
const ITEM_BASE_CLASS =
  "flex items-start gap-[var(--space-6)] px-[var(--space-7)] py-[var(--space-6)] min-h-[var(--tap-min)]";
const ITEM_BORDER_CLASS = "border-t border-[var(--line)]";
const ITEM_BOX_CLASS =
  "mt-[1px] h-[26px] w-[26px] flex-none rounded-[var(--r-control)] border-[1.5px] border-[var(--line-control-2)] bg-surface";
const ITEM_TEXT_CLASS = "flex-1 text-[length:var(--fs-lead)] leading-[21px]";
const ITEM_HINT_CLASS =
  "mt-[var(--space-2)] block text-[length:var(--fs-meta)] text-[var(--ink-3)]";
const FOOTER_CLASS =
  "mt-auto border-t border-[var(--line-strong)] px-[var(--space-7)] pt-[var(--space-6)] pb-[var(--space-8)]";
const FOOTER_BUTTON_CLASS =
  "h-[52px] w-full rounded-[var(--r-block)] border border-[var(--accent)] bg-accent text-[length:var(--fs-title)] font-medium text-[var(--ink-inverse)] opacity-45 disabled:cursor-not-allowed";

/** Название на языке интерфейса; если его нет — первое, что есть. */
function pickText(text: LocalizedText, locale: string): string {
  return text[locale] ?? Object.values(text)[0] ?? "";
}

function hasTitle(text: LocalizedText): boolean {
  return Object.keys(text).length > 0;
}

/**
 * Секции с пунктами, у которых есть название. Пункт без названия — это пустая
 * строка, которую методист ещё не заполнил (то же самое решение, что в
 * `validation.ts#parseItem`: такая строка не пункт, а место для будущего). Секция,
 * где таких пунктов не осталось, из предпросмотра тоже пропадает — не показывать
 * сотруднику заголовок без единого пункта под ним.
 */
function visibleSections(sections: readonly Section[]): Section[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasTitle(item.title)),
    }))
    .filter((section) => section.items.length > 0);
}

function totalItems(sections: readonly Section[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

/** Подсказка о границах числового пункта: обе, если есть обе, иначе — какая есть. */
function rangeHint(item: Item, t: Translate): string | null {
  if (item.type !== "number") return null;
  if (item.min !== undefined && item.max !== undefined) {
    return t("preview.range", { min: item.min, max: item.max });
  }
  if (item.min !== undefined) return String(item.min);
  if (item.max !== undefined) return String(item.max);
  return null;
}

function ItemRow({
  item,
  locale,
  t,
  isFirst,
}: {
  readonly item: Item;
  readonly locale: string;
  readonly t: Translate;
  readonly isFirst: boolean;
}): ReactElement {
  const range = rangeHint(item, t);

  return (
    <div
      data-testid="preview-item"
      className={`${ITEM_BASE_CLASS} ${isFirst ? "" : ITEM_BORDER_CLASS}`}
    >
      <span className={ITEM_BOX_CLASS} />
      <span className={ITEM_TEXT_CLASS}>
        {pickText(item.title, locale)}
        {item.critical ? (
          <span className="ml-[var(--space-2)] font-bold text-[var(--warn-mark)]">
            !
          </span>
        ) : null}
        {item.critical ? (
          <span className={ITEM_HINT_CLASS}>{t("preview.critical")}</span>
        ) : null}
        {range !== null ? (
          <span className={ITEM_HINT_CLASS}>{range}</span>
        ) : null}
      </span>
    </div>
  );
}

function ProgressBar({
  total,
  t,
}: {
  readonly total: number;
  readonly t: Translate;
}): ReactElement {
  return (
    <div className="mt-[var(--space-6)] flex items-center gap-[var(--space-5)]">
      <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <i style={{ width: "0%" }} className="bg-accent block h-full" />
      </span>
      <span className="text-[length:var(--fs-meta)] text-[var(--ink-2)] whitespace-nowrap">
        {t("preview.progress", { done: 0, total })}
      </span>
    </div>
  );
}

export async function PreviewScreen({
  id,
}: {
  readonly id: string;
}): Promise<ReactElement> {
  const state = await loadEditor(id);
  if (state === null) notFound();

  const locale = await getLocale();
  const t = await getTranslations("editor");

  const title = pickText(state.checklist.title, locale);
  const address =
    state.station === null
      ? t("list.noStation")
      : `${state.station.countryName} · ${state.station.storeName} · ${state.station.name}`;
  const sections = visibleSections(state.sections);
  const total = totalItems(sections);

  return (
    <div
      data-testid="preview-screen"
      className="min-h-screen bg-[var(--canvas)]"
    >
      <div className="mx-auto max-w-[420px] px-[var(--space-6)] pt-[var(--space-6)]">
        <div className={NOTICE_CLASS}>
          <div className="flex-1">{t("preview.notice")}</div>
          <a href={checklistPath(id)} className="font-medium whitespace-nowrap">
            {t("preview.back")}
          </a>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <header className={HEADER_CLASS}>
          <div className="text-[length:var(--fs-display)] leading-[var(--lh-display)] font-semibold">
            {title}
          </div>
          <div className="mt-[var(--space-2)] text-[length:var(--fs-meta)] text-[var(--ink-3)]">
            {address}
          </div>
          {total > 0 ? <ProgressBar total={total} t={t} /> : null}
        </header>

        {total === 0 ? (
          <p className="m-0 p-[var(--space-7)] text-[length:var(--fs-dense)] text-[var(--ink-3)]">
            {t("preview.empty")}
          </p>
        ) : (
          <>
            {sections.map((section, sectionIndex) => (
              <div key={section.id}>
                {pickText(section.title, locale) === "" ? null : (
                  <div className={SECTION_TITLE_CLASS}>
                    {pickText(section.title, locale)}
                  </div>
                )}
                {section.items.map((item, itemIndex) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    t={t}
                    isFirst={sectionIndex === 0 && itemIndex === 0}
                  />
                ))}
              </div>
            ))}
            <div className={FOOTER_CLASS}>
              <button type="button" disabled className={FOOTER_BUTTON_CLASS}>
                {t("preview.left", { count: total })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
