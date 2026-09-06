-- Обратный ход 0003_jsonb_size_limits.
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_answers_size";
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_snapshot_size";
ALTER TABLE "checklist_versions" DROP CONSTRAINT IF EXISTS "checklist_versions_sections_size";
