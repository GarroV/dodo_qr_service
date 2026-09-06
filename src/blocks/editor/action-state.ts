// Состояние серверных действий редактора. Живёт отдельно от самих действий, потому что
// файл с "use server" имеет право экспортировать только асинхронные функции: значение
// по умолчанию и типы там оказались бы ошибкой сборки.
import type { EditorErrorCode } from "./validation";

/** Что показать методисту после нажатия кнопки: тишину, подтверждение или отказ. */
export interface EditorActionState {
  status: "idle" | "saved" | "published" | "failed";
  /** Код отказа для словаря сообщений; `unknown` — сбой, которого мы не предусмотрели. */
  errorCode?: EditorErrorCode | "unknown";
  /** Предел из сообщения об отказе: «не больше N пунктов». */
  limit?: number;
  /** Номер только что опубликованной версии. */
  versionNumber?: number;
}

export const INITIAL_EDITOR_STATE: EditorActionState = { status: "idle" };
