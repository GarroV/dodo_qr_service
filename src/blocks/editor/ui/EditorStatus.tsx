import { useTranslations } from "next-intl";

import type { EditorActionState } from "../action-state";
import type { VersionSummary } from "../drafts";

const TAG_DRAFT =
  "inline-flex h-[20px] items-center rounded-[var(--r-mark)] border border-[var(--line-strong)] bg-[var(--surface-3)] px-[var(--space-4)] text-[length:var(--fs-micro)] font-semibold tracking-[var(--tracking-micro)] whitespace-nowrap text-[var(--st-draft)] uppercase";
const META_CLASS =
  "text-[length:var(--fs-meta)] whitespace-nowrap text-[var(--ink-3)]";

/**
 * Состояние чек-листа в верхней полосе: метка черновика, какая версия опубликована
 * сейчас и чем закончилось последнее действие. Отказ показывается тут же и текстом,
 * а не кодом: код пришёл с сервера, а слова выбирает экран — интерфейс двуязычный.
 */
export function EditorStatus({
  versions,
  saveState,
  publishState,
}: {
  readonly versions: readonly VersionSummary[];
  readonly saveState: EditorActionState;
  readonly publishState: EditorActionState;
}) {
  const t = useTranslations("editor");
  const published = versions.find((version) => version.status === "published");
  const failed =
    saveState.status === "failed"
      ? saveState
      : publishState.status === "failed"
        ? publishState
        : null;

  if (failed !== null) {
    return (
      <span
        role="alert"
        data-testid="editor-error"
        className="text-err rounded-[var(--r-control)] border border-[var(--err-line)] bg-[var(--err-soft)] px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--fs-dense)]"
      >
        {t(`errors.${failed.errorCode ?? "unknown"}`, {
          limit: failed.limit ?? 0,
        })}
      </span>
    );
  }

  if (publishState.status === "published") {
    return (
      <span data-testid="editor-published" className={META_CLASS}>
        {t("screen.published", { number: publishState.versionNumber ?? 0 })}
      </span>
    );
  }

  return (
    <>
      <span className={TAG_DRAFT}>{t("screen.draftTag")}</span>
      <span data-testid="editor-meta" className={META_CLASS}>
        {saveState.status === "saved"
          ? t("screen.saved")
          : published === undefined
            ? t("screen.neverPublished")
            : t("screen.publishedMeta", {
                number: published.versionNumber ?? 0,
              })}
      </span>
    </>
  );
}
