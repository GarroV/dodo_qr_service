// Решения серверных действий, вынесенные из самих действий: файл действий помечен
// `"use server"` и может экспортировать только асинхронные функции, то есть его логику
// нечем проверить тестом. Здесь она обычная и проверяется.
import { CatalogError } from "../errors";
import type { CatalogView } from "./view";

/**
 * Значение поля формы строкой. Файл вместо строки — не наш случай, но и не повод
 * падать: пустая строка не пройдёт проверку имени и вернётся понятным отказом.
 */
export function formField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Куда вести после неудачного удаления пиццерии.
 *
 * Требование подтверждения — не ошибка, а следующий шаг сценария: экран показывает
 * карточку «в пиццерии N станций, удалить вместе с ними?», а не красную полосу.
 * Всё остальное (например запрет по истории заполнений) — именно отказ, и человек
 * обязан увидеть его текстом.
 */
export function afterDeleteStoreFailure(
  base: CatalogView,
  error: CatalogError,
): CatalogView {
  if (error.code === "confirmationRequired") {
    return { ...base, confirm: "store" };
  }
  return { ...base, error: error.code };
}
