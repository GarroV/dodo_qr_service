-- Режимы смены (D052, D055, D056) и режим, в котором пришло заполнение.
--
-- Таблица только пополняется: перестановка режима — новая строка, а не правка прежней.
-- Так требует D055 — удерживает от злоупотребления сокращением ровно то, что каждая
-- перестановка остаётся видимой (D052: гейта нет, есть прозрачность).
--
-- Действующий режим — последняя строка по паре (пиццерия, местная дата). Строки нет →
-- полная смена: сокращение всегда должно быть осознанным действием, а не значением
-- по умолчанию.
CREATE TABLE "store_shift_modes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE RESTRICT,
  -- Местная дата пиццерии, а не UTC: сутки кончаются там, где работает смена (D026).
  "local_date" date NOT NULL,
  "mode" text NOT NULL,
  -- Причина сокращения: сколько людей вышло и сколько положено по стандарту.
  -- Необязательна — заставлять считать людей на входе значит вернуть трение,
  -- ради отсутствия которого от гейта и отказались.
  "staff_present" integer,
  "staff_expected" integer,
  "set_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_shift_modes_mode" CHECK ("mode" in ('normal', 'reduced', 'critical')),
  CONSTRAINT "store_shift_modes_staff_present" CHECK ("staff_present" is null or "staff_present" >= 0),
  CONSTRAINT "store_shift_modes_staff_expected" CHECK ("staff_expected" is null or "staff_expected" >= 0)
);

-- Главный запрос — «действующий режим этой пиццерии на сегодня»: отбор по паре и
-- самая свежая строка сверху покрываются одним индексом.
CREATE INDEX "store_shift_modes_current_idx"
  ON "store_shift_modes" ("store_id", "local_date", "set_at" DESC);

-- Режим, в котором заполняли. Хранится в самом заполнении, а не вычисляется задним
-- числом по store_shift_modes: перестановка режима вечером не имеет права переписать
-- то, в каком режиме заполняли утром (принцип 3, D002).
ALTER TABLE "submissions" ADD COLUMN "mode" text DEFAULT 'normal' NOT NULL;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_mode"
  CHECK ("mode" in ('normal', 'reduced', 'critical'));
