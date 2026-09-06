-- Обратный ход 0001_version_station: снятие заморозки станции в версии.
ALTER TABLE "checklist_versions" DROP CONSTRAINT IF EXISTS "checklist_versions_station_id_stations_id_fk";
ALTER TABLE "checklist_versions" DROP COLUMN IF EXISTS "station_id";
