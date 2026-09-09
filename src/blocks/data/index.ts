// Публичный вход в блок data. Остальные блоки импортируют только отсюда:
// прямое обращение к драйверу базы мимо этого слоя запрещено правилом границ модулей
// (`db-only-through-data` в .dependency-cruiser.cjs).
export type {
  Answer,
  Item,
  ItemType,
  LocalizedText,
  Section,
  Severity,
  ShiftMode,
  VersionStatus,
} from "./types";

export {
  isItemInMode,
  isSeverity,
  isShiftMode,
  requiresCommentOnFailure,
  sectionsForMode,
  severityOf,
} from "./severity";

export type {
  Block,
  Checklist,
  ChecklistVersion,
  Country,
  Station,
  Store,
  StoreShiftMode,
  Submission,
} from "./schema";
export {
  blocks,
  checklistVersions,
  checklists,
  countries,
  stations,
  storeShiftModes,
  stores,
  submissions,
} from "./schema";

export type { Database } from "./client";
export { getDb } from "./client";

export type { VersionWithChecklist } from "./checklists";
export {
  getDraft,
  getPublishedVersionForStation,
  publishVersion,
} from "./checklists";

export type {
  SaveSubmissionInput,
  SubmissionDetail,
  SubmissionFilter,
  SubmissionRow,
} from "./submissions";
export { getSubmission, listSubmissions, saveSubmission } from "./submissions";

export { countFailedCritical, flattenItems, isFailed } from "./grading";

export type { SetShiftModeInput, ShiftModeState } from "./shift-modes";
export {
  getShiftMode,
  listShiftModeChanges,
  setShiftMode,
} from "./shift-modes";

// Накат и откат миграций через этот вход НЕ выставляются: `migrator.ts` вычисляет путь
// к каталогу миграций через `new URL("./migrations", import.meta.url)`, а сборщик Next
// (Turbopack) принимает это за импорт модуля и не может его разрешить — любая страница
// админки, импортирующая этот файл, переставала собираться (найдено блоком catalog при
// проверке экрана в живом браузере). Настоящие потребители миграций — прогон тестов и
// `scripts/db-rollback.mjs` — и так берут их прямо из `./migrator`, минуя этот вход.
