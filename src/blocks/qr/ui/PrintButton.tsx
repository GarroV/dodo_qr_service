"use client";

import type { ReactElement } from "react";

/**
 * Кнопка «Печать» (`.btn.btn--primary` из эталона): вызывает `window.print()`
 * прямо на текущей странице. CSS печати живёт в `PrintSheet.tsx`
 * (`@media print`) и прячет всё, кроме листа с наклейками, — саму кнопку в том
 * числе, ей на бумаге делать нечего.
 *
 * Единственный клиентский компонент экрана — ровно потому, что `window.print`
 * есть только в браузере. Текст приходит уже переведённым пропом: провайдера
 * next-intl в разметке нет (см. `editor/ui/NewChecklistForm.tsx`), поэтому
 * клиентские компоненты этого продукта не зовут `useTranslations` сами.
 */

const BTN_PRIMARY_CLASS =
  "bg-accent inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-[var(--accent)] px-[var(--space-6)] text-[length:var(--fs-body)] font-medium text-[var(--ink-inverse)] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]";

export interface PrintButtonProps {
  readonly label: string;
}

export function PrintButton({ label }: PrintButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-testid="qr-print"
      className={BTN_PRIMARY_CLASS}
      onClick={() => {
        window.print();
      }}
    >
      {label}
    </button>
  );
}
