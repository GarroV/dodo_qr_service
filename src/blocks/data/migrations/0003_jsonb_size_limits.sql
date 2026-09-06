-- Верхние границы JSONB у публично записываемых данных (T058). Замерено на PG 17:
-- чек-лист на 50 пунктов с двумя языками и подсказками — 22 КБ, ответы на него
-- с комментариями — 7 КБ. Пределы 256 КиБ и 64 КиБ — заслон от мусора с запасом
-- на порядок, а не рамка для продукта.
ALTER TABLE "checklist_versions" ADD CONSTRAINT "checklist_versions_sections_size" CHECK (pg_column_size(sections) <= 262144);--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_snapshot_size" CHECK (pg_column_size(snapshot) <= 262144);--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_answers_size" CHECK (pg_column_size(answers) <= 65536);
