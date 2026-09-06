-- Обратный ход миграции 0000_init. Порядок обратный связям: сначала то, что ссылается.
DROP TABLE IF EXISTS "submissions";
DROP TABLE IF EXISTS "checklist_versions";
DROP TABLE IF EXISTS "checklists";
DROP TABLE IF EXISTS "stations";
DROP TABLE IF EXISTS "stores";
DROP TABLE IF EXISTS "countries";
DROP TABLE IF EXISTS "blocks";
