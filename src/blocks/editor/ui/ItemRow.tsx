import { useTranslations } from "next-intl";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

import type { Item, ItemType } from "@/blocks/data";

/** Строка пункта в редакторе по эталону `docs/forge/design/screens/editor.html`. */
export interface ItemRowProps {
  readonly item: Item;
  /** Сквозной номер по всему чек-листу: в эталоне нумерация не начинается заново в секции. */
  readonly ordinal: number;
  readonly locale: string;
  readonly onTitle: (text: string) => void;
  readonly onPatch: (patch: Partial<Item>) => void;
  readonly onRemove: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

export function itemInputId(itemId: string): string {
  return `item-title-${itemId}`;
}

const ROW_CLASS =
  "grid grid-cols-[28px_1fr_auto] items-center gap-[var(--space-5)] border-b border-[var(--line)] px-[var(--space-6)] py-[var(--space-4)]";
const TITLE_CLASS =
  "text-ink h-[var(--control-h)] w-full rounded-[var(--r-control)] border border-transparent bg-transparent pl-[var(--space-3)] text-[length:var(--fs-lead)] hover:border-[var(--line)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-soft)] focus:outline-none";
const SELECT_CLASS =
  "text-ink bg-surface h-[var(--control-h-sm)] w-auto rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-4)] text-[length:var(--fs-dense)] focus:border-[var(--accent)] focus:outline-none";
const BOUND_CLASS =
  "text-ink bg-surface h-[var(--control-h-sm)] w-[62px] rounded-[var(--r-control)] border border-[var(--line-control)] text-center font-[family-name:var(--font-num)] text-[length:var(--fs-dense)] focus:border-[var(--accent)] focus:outline-none";

const ITEM_TYPES: readonly ItemType[] = ["bool", "number", "text"];

/** Ключ подписи типа ответа: "typeBool" | "typeNumber" | "typeText". */
function typeKey(type: ItemType): string {
  if (type === "number") return "typeNumber";
  if (type === "text") return "typeText";
  return "typeBool";
}

/** Граница диапазона: пустое поле означает «границы нет», а не ноль. */
function boundValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseBound(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function ItemRow({
  item,
  ordinal,
  locale,
  onTitle,
  onPatch,
  onRemove,
  onKeyDown,
  onPaste,
}: ItemRowProps) {
  const t = useTranslations("editor.item");
  const critical = item.critical;

  return (
    <div
      data-testid="editor-item"
      data-critical={critical ? "true" : "false"}
      className={`${ROW_CLASS} ${critical ? "bg-[var(--warn-soft)]" : "hover:bg-[var(--surface-2)]"}`}
    >
      <div className="text-right text-[length:var(--fs-meta)] text-[var(--ink-3)]">
        {ordinal}
      </div>

      <input
        id={itemInputId(item.id)}
        data-testid="item-title"
        className={TITLE_CLASS}
        value={item.title[locale] ?? ""}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onTitle(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />

      <div className="flex items-center gap-[var(--space-4)]">
        <select
          data-testid="item-type"
          className={SELECT_CLASS}
          value={item.type}
          aria-label={t("typeBool")}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onPatch({ type: event.target.value as ItemType });
          }}
        >
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(typeKey(type))}
            </option>
          ))}
        </select>

        {item.type === "number" ? (
          <span className="flex items-center gap-[var(--space-3)] text-[length:var(--fs-meta)] text-[var(--ink-3)]">
            {t("from")}
            <input
              data-testid="item-min"
              className={BOUND_CLASS}
              inputMode="decimal"
              aria-label={t("min")}
              value={boundValue(item.min)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onPatch({ min: parseBound(event.target.value) });
              }}
            />
            {t("to")}
            <input
              data-testid="item-max"
              className={BOUND_CLASS}
              inputMode="decimal"
              aria-label={t("max")}
              value={boundValue(item.max)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onPatch({ max: parseBound(event.target.value) });
              }}
            />
          </span>
        ) : null}

        <button
          type="button"
          role="switch"
          aria-checked={critical}
          data-testid="item-critical"
          className="inline-flex cursor-pointer items-center gap-[var(--space-3)] border-0 bg-transparent whitespace-nowrap"
          onClick={() => {
            onPatch({ critical: !critical });
          }}
        >
          <span
            className={`relative h-[17px] w-[30px] rounded-[9px] transition-colors ${critical ? "bg-[var(--warn-mark)]" : "bg-[var(--seg-track)]"}`}
          >
            <span
              className={`bg-surface absolute top-[2px] left-[2px] h-[13px] w-[13px] rounded-full shadow-[var(--sh-xs)] transition-transform ${critical ? "translate-x-[13px]" : ""}`}
            />
          </span>
          <span
            className={`text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] uppercase ${critical ? "text-[var(--warn-ink)]" : "text-[var(--ink-3)]"}`}
          >
            {t("critical")}
          </span>
        </button>

        <button
          type="button"
          data-testid="item-remove"
          aria-label={t("remove")}
          className="text-err flex h-[var(--control-h-sm)] cursor-pointer items-center rounded-[var(--r-control)] border border-transparent bg-transparent px-[var(--space-5)] hover:border-[var(--err-line)] hover:bg-[var(--err-soft)]"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}
