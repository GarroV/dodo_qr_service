import { useTranslations } from "next-intl";

import { CHECKLISTS_PATH } from "../routes";

/**
 * Левое меню админки по эталону (`docs/forge/design/screens/editor.html`): 208 px,
 * две группы разделов, внизу — кто вошёл.
 *
 * Разделы, которых в продукте ещё нет, — `<span aria-disabled>`, а не ссылка: ссылка
 * вела бы в 404. Адрес справочника вписан строкой, а не импортирован из блока `catalog`:
 * границы модулей запрещают редактору зависеть от справочника (.dependency-cruiser.cjs),
 * и общий каркас для двух блоков сейчас негде положить, кроме как продублировать.
 */
const CATALOG_PATH = "/admin/catalog";

const LABEL_CLASS =
  "px-[var(--space-7)] pb-[var(--space-3)] text-[length:var(--fs-micro)] leading-[var(--lh-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";
const ITEM_CLASS =
  "flex items-center gap-[var(--space-5)] border-l-2 border-transparent px-[var(--space-7)] py-[var(--space-4)] text-[var(--ink-2)] no-underline hover:bg-[var(--surface-3)] hover:text-[var(--ink)]";
const ITEM_SOON_CLASS =
  "flex items-center gap-[var(--space-5)] border-l-2 border-transparent px-[var(--space-7)] py-[var(--space-4)] text-[var(--ink-3)]";
const ITEM_ACTIVE_CLASS =
  "text-accent flex items-center gap-[var(--space-5)] border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-[var(--space-7)] py-[var(--space-4)] font-medium no-underline";

export function AdminNav({
  active,
}: {
  readonly active?: "checklists" | undefined;
}) {
  const t = useTranslations("editor.nav");
  const soon = t("soon");

  return (
    <nav className="bg-surface flex flex-col gap-[var(--space-8)] border-r border-[var(--line-strong)] py-[var(--space-7)]">
      <div className="px-[var(--space-7)] text-[length:var(--fs-title)] leading-[var(--lh-title)] font-semibold tracking-[-0.01em]">
        {t("brand")}{" "}
        <span className="font-normal text-[var(--ink-3)]">
          {t("brandMuted")}
        </span>
      </div>

      <div className="flex flex-col">
        <div className={LABEL_CLASS}>{t("work")}</div>
        <a
          className={active === "checklists" ? ITEM_ACTIVE_CLASS : ITEM_CLASS}
          href={CHECKLISTS_PATH}
        >
          {t("checklists")}
        </a>
        <span className={ITEM_SOON_CLASS} aria-disabled="true" title={soon}>
          {t("library")}
        </span>
        <span className={ITEM_SOON_CLASS} aria-disabled="true" title={soon}>
          {t("feed")}
        </span>
      </div>

      <div className="flex flex-col">
        <div className={LABEL_CLASS}>{t("reference")}</div>
        <a className={ITEM_CLASS} href={CATALOG_PATH}>
          {t("catalog")}
        </a>
        <span className={ITEM_SOON_CLASS} aria-disabled="true" title={soon}>
          {t("qr")}
        </span>
      </div>

      <div className="mt-auto px-[var(--space-7)] text-[length:var(--fs-meta)] text-[var(--ink-3)]">
        {t("signedIn")}
        <br />
        {t("role")}
      </div>
    </nav>
  );
}
