import type { ReactElement, ReactNode } from "react";

import { AdminNav } from "./AdminNav";

/**
 * Каркас экранов ленты: левое меню и верхняя полоса с крошкой, заголовком и действием.
 * Ровно тот же каркас, что у остальных разделов админки, — эталон у всех экранов один
 * (`docs/forge/design/app.css`), а копия в каждом блоке своя из-за границ модулей.
 */

const H1_CLASS =
  "text-[length:var(--fs-display)] leading-[var(--lh-display)] font-semibold";

export interface AdminShellProps {
  /** Тестовый идентификатор корня: у каждого экрана свой. */
  readonly testId: string;
  readonly breadcrumb: ReactNode;
  readonly title: string;
  readonly topbarAction: ReactNode;
  readonly children: ReactNode;
  /** Узкая колонка (880 px) — карточка заполнения; лента идёт во всю ширину. */
  readonly narrow?: boolean;
}

export function AdminShell({
  testId,
  breadcrumb,
  title,
  topbarAction,
  children,
  narrow = false,
}: AdminShellProps): ReactElement {
  return (
    <div
      data-testid={testId}
      className="grid min-h-screen grid-cols-[208px_1fr]"
    >
      <AdminNav />

      <div className="flex min-w-0 flex-col">
        <header className="bg-surface flex items-center gap-[var(--space-7)] border-b border-[var(--line-strong)] px-[var(--space-9)] py-[var(--space-7)]">
          <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
            <div className="text-[length:var(--fs-meta)] text-[var(--ink-3)]">
              {breadcrumb}
            </div>
            <h1 className={H1_CLASS}>{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-[var(--space-4)]">
            {topbarAction}
          </div>
        </header>

        <div
          className={`flex flex-col gap-[var(--space-8)] p-[var(--space-9)]${
            narrow ? " max-w-[880px]" : ""
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
