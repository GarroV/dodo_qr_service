// Схема данных продукта: справочник (страна → пиццерия → станция), чек-листы
// с неизменяемыми версиями и заполнения. Источник истины для миграций.
//
// Правила целостности живут здесь, в базе, а не в коде:
//   · одна опубликованная версия на чек-лист и один черновик — частичные уникальные индексы;
//   · удаление страны, пиццерии, станции и версии запрещено, пока на них ссылается история
//     (принцип 3: история заполнений неприкосновенна).
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  Answer,
  Item,
  LocalizedText,
  Section,
  VersionStatus,
} from "./types";

const CREATED_AT = "created_at";

// Верхние границы JSONB стоят в самой базе, а не только в коде: `submissions` —
// единственная таблица, куда пишет неопознанный человек из интернета, и забытая
// проверка в блоке fill не должна означать, что база примет что угодно.
// Числа взяты с запасом от измеренного: чек-лист станции на 50 пунктов с двумя
// языками и подсказками занимает 22 КБ, ответы на него с комментариями — 7 КБ
// (замерено `pg_column_size` на PostgreSQL 17). Чек-лист — единицы-десятки пунктов
// (принципы 1 и 2), поэтому предел заведомо недостижим в работе и остаётся заслоном
// от мусора. `pg_column_size` внутри CHECK видит несжатый размер значения, так что
// граница не зависит от того, насколько удачно сжался вход.
const SECTIONS_MAX_BYTES = 262_144; // 256 КиБ — двенадцатикратный запас к 22 КБ
const ANSWERS_MAX_BYTES = 65_536; // 64 КиБ — девятикратный запас к 7 КБ

function jsonbSizeLimit(column: string, maxBytes: number) {
  return sql.raw(`pg_column_size(${column}) <= ${String(maxBytes)}`);
}

/** Серверное время: все отметки берутся из `now()` базы, а не с устройства. */
function serverTimestamp(name: string) {
  return timestamp(name, { withTimezone: true }).notNull().defaultNow();
}

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Язык страны — запасной для экрана заполнения, когда язык устройства не поддержан.
    locale: text("locale").notNull().default("en"),
    createdAt: serverTimestamp(CREATED_AT),
  },
  () => [check("countries_locale", sql`locale in ('ru', 'en')`)],
);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryId: uuid("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // Часовой пояс пиццерии: по нему окно чек-листа сравнивается с местным временем,
    // иначе утренний чек-лист в Казахстане открывался бы днём.
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: serverTimestamp(CREATED_AT),
  },
  (table) => [index("stores_country_idx").on(table.countryId)],
);

export const stations = pgTable(
  "stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // Код из ссылки QR. Уникален и перевыпускается (D006): выпуск фиксируется временем.
    code: text("code").notNull().unique(),
    codeIssuedAt: serverTimestamp("code_issued_at"),
    createdAt: serverTimestamp(CREATED_AT),
  },
  (table) => [index("stations_store_idx").on(table.storeId)],
);

export const checklists = pgTable(
  "checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Станция может быть не назначена: чек-лист заводится и привязывается отдельно,
    // а удаление станции отвязывает чек-лист, но не удаляет ни его, ни историю.
    stationId: uuid("station_id").references(() => stations.id, {
      onDelete: "set null",
    }),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    // Окно времени вместо расписания смен (D004): утренний чек-лист утром, вечерний вечером.
    windowStart: time("window_start").notNull(),
    windowEnd: time("window_end").notNull(),
    createdAt: serverTimestamp(CREATED_AT),
  },
  (table) => [
    index("checklists_station_idx").on(table.stationId),
    // Равные границы делают условие выбора версии всегда ложным: чек-лист не открылся бы
    // ни на одной станции и ни в одну минуту, молча. Конец раньше начала — наоборот,
    // нормальное окно через полночь (22:00–02:00), и запрещать его нельзя.
    check("checklists_window_not_empty", sql`window_start <> window_end`),
  ],
);

export const checklistVersions = pgTable(
  "checklist_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => checklists.id, { onDelete: "restrict" }),
    // Номер есть у опубликованных и архивных версий; у черновика номера нет.
    versionNumber: integer("version_number"),
    status: text("status").$type<VersionStatus>().notNull(),
    // Станция замораживается вместе с содержимым в момент публикации, а не читается
    // из мутируемой checklists.station_id при сохранении заполнения: иначе перенос
    // чек-листа на другую станцию во время заполнения уводил бы заполнение в чужую
    // историю (принцип 3). У черновика станции нет — он ещё не опубликован;
    // у версии чек-листа, не привязанного к станции на момент публикации, тоже.
    stationId: uuid("station_id").references(() => stations.id, {
      onDelete: "set null",
    }),
    sections: jsonb("sections").$type<Section[]>().notNull().default([]),
    createdAt: serverTimestamp(CREATED_AT),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    // Требование контракта: одна опубликованная версия на чек-лист — правилом базы,
    // а не проверкой в коде, иначе гонка двух публикаций даёт две активные версии.
    uniqueIndex("checklist_versions_one_published_idx")
      .on(table.checklistId)
      .where(sql`status = 'published'`),
    uniqueIndex("checklist_versions_one_draft_idx")
      .on(table.checklistId)
      .where(sql`status = 'draft'`),
    uniqueIndex("checklist_versions_number_idx").on(
      table.checklistId,
      table.versionNumber,
    ),
    check(
      "checklist_versions_status",
      sql`status in ('draft', 'published', 'archived')`,
    ),
    check(
      "checklist_versions_draft_has_no_number",
      sql`(status = 'draft') = (version_number is null)`,
    ),
    check(
      "checklist_versions_draft_has_no_publish_time",
      sql`(status = 'draft') = (published_at is null)`,
    ),
    check(
      "checklist_versions_sections_size",
      jsonbSizeLimit("sections", SECTIONS_MAX_BYTES),
    ),
  ],
);

export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  items: jsonb("items").$type<Item[]>().notNull().default([]),
  createdAt: serverTimestamp(CREATED_AT),
  updatedAt: serverTimestamp("updated_at"),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Заполнение всегда ссылается на конкретную версию — ту, что была отдана клиенту.
    versionId: uuid("version_id")
      .notNull()
      .references(() => checklistVersions.id, { onDelete: "restrict" }),
    // Станция запоминается здесь: перенос чек-листа на другую станцию не должен
    // задним числом переписывать, где заполняли (принцип 3).
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "restrict" }),
    // Снимок пунктов на момент заполнения (D002): второй способ хранения истории.
    snapshot: jsonb("snapshot").$type<Section[]>().notNull(),
    answers: jsonb("answers").$type<Answer[]>().notNull(),
    // Начало — с устройства сотрудника (нужно для длительности), отправка — время сервера.
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    submittedAt: serverTimestamp("submitted_at"),
  },
  (table) => [
    index("submissions_submitted_at_idx").on(table.submittedAt),
    index("submissions_station_idx").on(table.stationId),
    index("submissions_version_idx").on(table.versionId),
    check(
      "submissions_snapshot_size",
      jsonbSizeLimit("snapshot", SECTIONS_MAX_BYTES),
    ),
    check(
      "submissions_answers_size",
      jsonbSizeLimit("answers", ANSWERS_MAX_BYTES),
    ),
  ],
);

export type Country = typeof countries.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Station = typeof stations.$inferSelect;
export type Checklist = typeof checklists.$inferSelect;
export type ChecklistVersion = typeof checklistVersions.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
