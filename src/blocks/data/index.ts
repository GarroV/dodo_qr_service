// Публичный вход в блок data. Остальные блоки импортируют только отсюда:
// прямое обращение к драйверу базы мимо этого слоя запрещено правилом границ модулей
// (`db-only-through-data` в .dependency-cruiser.cjs).
export type {
  Answer,
  Item,
  ItemType,
  LocalizedText,
  Section,
  VersionStatus,
} from "./types";

export type {
  Block,
  Checklist,
  ChecklistVersion,
  Country,
  Station,
  Store,
  Submission,
} from "./schema";
export {
  blocks,
  checklistVersions,
  checklists,
  countries,
  stations,
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

export { applyMigrations, rollbackLastMigration } from "./migrator";
