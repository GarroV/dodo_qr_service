import { ChecklistsScreen } from "@/blocks/editor/ui/ChecklistsScreen";

/**
 * Экран «Чек-листы» (T0хх). Охрану админки страница не повторяет — она уже стоит в
 * `src/app/admin/layout.tsx`; сам экран читает данные внутри себя (`listChecklists()`),
 * поэтому странице здесь нечего собирать, кроме разметки.
 */
export default function ChecklistsPage() {
  return <ChecklistsScreen />;
}
