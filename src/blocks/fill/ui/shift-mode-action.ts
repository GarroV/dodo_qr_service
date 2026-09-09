"use server";

import { chooseShiftMode } from "../shift-mode";
import type { ShiftModeOutcome } from "../shift-mode";

/**
 * Выбор режима смены. Серверное действие, а не обработчик маршрута, — по той же
 * причине, что и приём заполнения (`submit-action.ts`): `page.tsx` и `route.ts`
 * в одном сегменте Next иметь не даёт, а адрес `/s/<код станции>` менять нельзя,
 * он напечатан внутри наклейки.
 *
 * Тело действия вызывает кто угодно, а не только наш экран: всё проверяется схемой
 * на границе внутри `chooseShiftMode`, здесь проверок нет намеренно — иначе их было
 * бы две в разных местах и они бы разъехались.
 */
export async function chooseShiftModeAction(
  input: unknown,
): Promise<ShiftModeOutcome> {
  return await chooseShiftMode(input, new Date());
}
