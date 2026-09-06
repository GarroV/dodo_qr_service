// Публикация версии чек-листа. Отдельное действие, а не «сохранение посильнее»:
// черновик правится сколько угодно, а опубликованная версия отдаётся на станцию и
// с этого мгновения не меняется никогда (принцип 3, D002).
//
// Вставку блока библиотеки публикация разворачивает в снимок: пункты блока переносятся
// в версию, и последующая правка блока их уже не трогает. Ссылка `{ blockId }` в версии
// остаётся — по ней библиотека узнаёт, какие опубликованные версии её блок затронул.
import type { ChecklistVersion } from "@/blocks/data";
import { getDraft, publishVersion } from "@/blocks/data";

import { saveDraft } from "./drafts";
import { EditorInputError, isUuid, parseSections } from "./validation";

function itemCount(sections: readonly { items: unknown[] }[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

/**
 * Публикует черновик новой версией.
 *
 * Порядок важен: сначала черновик освежается живыми пунктами вставленных блоков
 * (`saveDraft` делает это сам), и только потом `publishVersion` из блока `data` копирует
 * его в новую строку. Иначе в версию уехал бы снимок, отставший от библиотеки.
 * Обратный порядок — правка уже созданной версии — запрещён: версии неизменяемы.
 */
export async function publish(checklistId: string): Promise<ChecklistVersion> {
  if (!isUuid(checklistId)) {
    throw new EditorInputError("notFound", `Чек-листа ${checklistId} нет`);
  }

  const draft = await getDraft(checklistId);
  if (draft === null) {
    throw new EditorInputError(
      "notFound",
      `У чек-листа ${checklistId} нет черновика`,
    );
  }
  // Разбор той же проверкой, что и сохранение: пункт без названия — это пустая строка,
  // которую методист завёл Enter'ом и не заполнил. В версию, уходящую на станцию,
  // такая строка попасть не должна, а в черновике пусть остаётся.
  const sections = parseSections(draft.sections);
  if (itemCount(sections) === 0) {
    // Пустой чек-лист на станции — открытый по QR экран без единого пункта.
    throw new EditorInputError(
      "nothingToPublish",
      "В чек-листе нет ни одного пункта",
    );
  }

  await saveDraft(checklistId, sections);
  return publishVersion(checklistId);
}
