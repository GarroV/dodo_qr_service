// Адреса экранов редактора. Лежат отдельно от разметки, потому что нужны и страницам,
// и серверным действиям, и сквозным сценариям: один и тот же путь, записанный в трёх
// местах, разъезжается на первой же правке.

export const CHECKLISTS_PATH = "/admin/checklists";

/** Заведение чек-листа. Статический сегмент побеждает динамический `[id]` в Next. */
export const NEW_CHECKLIST_PATH = `${CHECKLISTS_PATH}/new`;

export function checklistPath(checklistId: string): string {
  return `${CHECKLISTS_PATH}/${checklistId}`;
}

/** Предпросмотр «как это увидит сотрудник» — тот же черновик, но экраном заполнения. */
export function checklistPreviewPath(checklistId: string): string {
  return `${checklistPath(checklistId)}/preview`;
}

/** Подтверждение удаления. Отдельный экран, а не диалог: он обязан заранее сказать, что
 *  именно произойдёт — «удалить полностью» и «убрать из работы» слишком разные вещи, чтобы
 *  выясняться после нажатия. Заодно работает без JavaScript, как и остальные формы. */
export function checklistDeletePath(checklistId: string): string {
  return `${checklistPath(checklistId)}/delete`;
}
