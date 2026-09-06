import { useTranslations } from "next-intl";

import type { Item } from "@/blocks/data";

/**
 * Пункт вставленного блока библиотеки: только для чтения. Правится он в самом блоке,
 * и правка приходит во все черновики сразу (D011) — поэтому здесь ни полей, ни кнопок,
 * а тип и критичность показаны метками, как в эталоне.
 */
export function LinkedItemRow({
  item,
  ordinal,
  locale,
}: {
  readonly item: Item;
  readonly ordinal: number;
  readonly locale: string;
}) {
  const t = useTranslations("editor.item");
  const critical = item.critical;

  const typeText =
    item.type === "number"
      ? `${t("typeNumber")}${range(item)}`
      : item.type === "text"
        ? t("typeText")
        : t("typeBool");

  return (
    <div
      data-testid="editor-item"
      data-linked="true"
      className={`grid grid-cols-[28px_1fr_auto] items-center gap-[var(--space-5)] border-b border-[var(--line)] px-[var(--space-6)] py-[var(--space-4)] opacity-85 ${critical ? "bg-[var(--warn-soft)]" : ""}`}
    >
      <div className="text-right text-[length:var(--fs-meta)] text-[var(--ink-3)]">
        {ordinal}
      </div>
      <div className="text-[length:var(--fs-lead)]">
        {item.title[locale] ?? Object.values(item.title)[0] ?? ""}
      </div>
      <div className="flex items-center gap-[var(--space-4)]">
        <span className="bg-surface-2 inline-flex h-[20px] items-center rounded-[var(--r-mark)] border border-[var(--line-strong)] px-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] whitespace-nowrap text-[var(--ink-2)] uppercase">
          {typeText}
        </span>
        {critical ? (
          <span className="inline-flex h-[20px] items-center rounded-[var(--r-mark)] border border-[var(--warn-line)] bg-[var(--warn-soft)] px-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] whitespace-nowrap text-[var(--warn-ink)] uppercase">
            {t("critical")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Диапазон числового пункта в метке: показывается та граница, которая задана. */
function range(item: Item): string {
  if (item.min === undefined && item.max === undefined) return "";
  return ` · ${item.min === undefined ? "" : String(item.min)}…${item.max === undefined ? "" : String(item.max)}`;
}
