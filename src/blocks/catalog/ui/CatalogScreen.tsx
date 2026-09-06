import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import { AdminShell } from "./AdminShell";
import { CatalogTree } from "./CatalogTree";
import { DetailCards } from "./DetailCards";
import type { CatalogModel } from "./model";

/**
 * Экран справочника «Страны и пиццерии» (T018) — сборка каркаса, дерева и
 * карточки правки/подтверждения по эталону
 * `docs/forge/design/screens/catalog.html`. Сам ничего не считает: всё нужное
 * уже лежит в `model` (см. `ui/build-model.ts`).
 */

const ERROR_NOTICE_CLASS =
  "text-err flex gap-[var(--space-5)] rounded-[var(--r-block)] border border-[var(--err-line)] bg-[var(--err-soft)] px-[var(--space-7)] py-[var(--space-6)] text-[length:var(--fs-dense)]";
const TOPBAR_BUTTON_CLASS =
  "text-ink bg-surface inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-6)] text-[length:var(--fs-body)] font-medium disabled:cursor-not-allowed disabled:opacity-60";

export async function CatalogScreen({
  model,
}: {
  readonly model: CatalogModel;
}): Promise<ReactElement> {
  const t = await getTranslations("catalog");

  return (
    <AdminShell
      testId="catalog-screen"
      breadcrumb={t("breadcrumb")}
      title={t("title")}
      topbarAction={
        <button type="button" disabled className={TOPBAR_BUTTON_CLASS}>
          {t("actions.qrStations")}
        </button>
      }
    >
      {model.errorCode !== null ? (
        <p data-testid="catalog-error" className={ERROR_NOTICE_CLASS}>
          {t(`errors.${model.errorCode}`)}
        </p>
      ) : null}
      <CatalogTree model={model} />
      <DetailCards model={model} />
    </AdminShell>
  );
}
