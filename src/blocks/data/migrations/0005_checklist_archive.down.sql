-- Обратный ход 0005_checklist_archive. Снятые с работы чек-листы после откатa снова
-- появятся в списке и на станциях: признака, по которому их скрывали, больше нет.
ALTER TABLE "checklists" DROP COLUMN IF EXISTS "archived_at";
