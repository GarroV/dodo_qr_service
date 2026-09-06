-- Составной индекс под главный фильтр ленты (T059): «заполнения этой станции
-- за период, свежие сверху». Прежний индекс по одной station_id — его левый префикс,
-- то есть лишняя запись на каждое сохранение в публичной точке записи.
DROP INDEX "submissions_station_idx";--> statement-breakpoint
CREATE INDEX "submissions_station_submitted_at_idx" ON "submissions" USING btree ("station_id","submitted_at" DESC NULLS LAST);
