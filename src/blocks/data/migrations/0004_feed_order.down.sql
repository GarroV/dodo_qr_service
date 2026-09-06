-- Обратный ход 0004_feed_order.
DROP INDEX IF EXISTS "submissions_station_submitted_at_idx";
CREATE INDEX "submissions_station_idx" ON "submissions" USING btree ("station_id");
