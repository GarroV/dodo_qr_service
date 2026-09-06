import { useTranslations } from "next-intl";

import { FEED_PATH } from "../routes";

/**
 * Левое меню админки по эталону (`docs/forge/design/screens/feed.html`): 208 px,
 * две группы разделов, внизу — кто вошёл.
 *
 * Адреса соседних разделов вписаны строками, а не импортированы из их блоков: границы
 * модулей запрещают ленте зависеть от редактора, справочника и QR (.dependency-cruiser.cjs).
 * Так же поступают меню в блоках `editor` и `qr` — общего места для каркаса в проекте нет.
 * Библиотека блоков ещё не существует, поэтому она `<span aria-disabled>`, а не ссылка:
 * ссылка вела бы в 404.
 */
const CHECKLISTS_PATH = "/admin/checklists";
const CATALOG_PATH = "/admin/catalog";
const QR_PATH = "/admin/qr";

const LABEL_CLASS =
  "px-[var(--space-7)] pb-[var(--space-3)] text-[length:var(--fs-micro)] leading-[var(--lh-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";
const ITEM_CLASS =
  "flex items-center gap-[var(--space-5)] border-l-2 border-transparent px-[var(--space-7)] py-[var(--space-4)] text-[var(--ink-2)] no-underline hover:bg-[var(--surface-3)] hover:text-[var(--ink)]";
const ITEM_SOON_CLASS =
  "flex items-center gap-[var(--space-5)] border-l-2 border-transparent px-[var(--space-7)] py-[var(--space-4)] text-[var(--ink-3)]";
const ITEM_ACTIVE_CLASS =
  "text-accent flex items-center gap-[var(--space-5)] border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-[var(--space-7)] py-[var(--space-4)] font-medium no-underline";

export function AdminNav() {
  const t = useTranslations("feed.nav");

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
        <a className={ITEM_CLASS} href={CHECKLISTS_PATH}>
          {t("checklists")}
        </a>
        <span
          className={ITEM_SOON_CLASS}
          aria-disabled="true"
          title={t("soon")}
        >
          {t("library")}
        </span>
        <a
          className={ITEM_ACTIVE_CLASS}
          href={FEED_PATH}
          aria-current="page"
          data-testid="nav-feed"
        >
          {t("feed")}
        </a>
      </div>

      <div className="flex flex-col">
        <div className={LABEL_CLASS}>{t("reference")}</div>
        <a className={ITEM_CLASS} href={CATALOG_PATH}>
          {t("catalog")}
        </a>
        <a className={ITEM_CLASS} href={QR_PATH}>
          {t("qr")}
        </a>
      </div>

      <div className="mt-auto px-[var(--space-7)] text-[length:var(--fs-meta)] text-[var(--ink-3)]">
        {t("signedIn")}
        <br />
        {t("role")}
      </div>
    </nav>
  );
}
