-- Станция замораживается в версии в момент публикации (T056).
-- Читать её из мутируемой checklists.station_id при сохранении заполнения нельзя:
-- перенос чек-листа между выдачей версии и отправкой уводил заполнение в чужую историю.
ALTER TABLE "checklist_versions" ADD COLUMN "station_id" uuid;--> statement-breakpoint
ALTER TABLE "checklist_versions" ADD CONSTRAINT "checklist_versions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Перенос уже опубликованных и архивных версий на текущую привязку чек-листа:
-- другого источника у них нет, а до этой миграции заполнение всё равно писалось
-- по этой же колонке. Черновики остаются без станции: они ещё не опубликованы.
UPDATE "checklist_versions" v
   SET "station_id" = c."station_id"
  FROM "checklists" c
 WHERE c."id" = v."checklist_id"
   AND v."status" <> 'draft';
