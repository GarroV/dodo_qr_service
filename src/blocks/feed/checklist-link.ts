// Ссылка из карточки на сам чек-лист в редакторе.
//
// Адрес вписан строкой, а не импортирован из блока `editor`: границы модулей запрещают
// ленте зависеть от редактора (.dependency-cruiser.cjs). Так же поступает редактор со
// ссылкой на справочник — это принятая в проекте цена за независимые блоки.
const CHECKLISTS_PATH = "/admin/checklists";

export function checklistHref(checklistId: string): string {
  return `${CHECKLISTS_PATH}/${encodeURIComponent(checklistId)}`;
}
