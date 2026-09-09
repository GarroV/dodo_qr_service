-- Обратный ход 0006_shift_modes. История выбранных режимов теряется полностью, а
-- заполнения перестают помнить, в каком режиме их заполняли: сокращённые прогоны
-- после отката выглядят как полные.
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_mode";
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "mode";
DROP TABLE IF EXISTS "store_shift_modes";
