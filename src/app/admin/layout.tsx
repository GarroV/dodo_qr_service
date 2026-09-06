import type { ReactNode } from "react";

import { requireAdmin } from "@/blocks/auth/guard";

/**
 * Охрана всей админки. Любой новый экран в `src/app/admin/**` попадает под неё сам,
 * без правок здесь и без памяти следующего разработчика.
 *
 * Чего разметка не закрывает: серверные действия и обработчики `route.ts` — они
 * выполняются мимо дерева разметки. Каждое такое место зовёт `requireAdmin()` само;
 * что ни один маршрут админки не забыт, проверяет `e2e/admin-guard.spec.ts`,
 * который перебирает файлы маршрутов, а не заранее записанный список.
 */
export default async function AdminLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  await requireAdmin();

  return children;
}
