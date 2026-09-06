// Списки для экранов редактора: чек-листы (экран «Чек-листы») и станции (выбор в свойствах).
//
// Оба запроса читают таблицы, которые ведут другие блоки — справочник (`catalog`)
// и заполнения (`fill`). Это разрешено прямо: свои запросы блок пишет у себя, беря из
// `data` схему и `getDb()`, а не заказывает функции в чужом блоке (D024).
import { asc, sql } from "drizzle-orm";

import type { LocalizedText } from "@/blocks/data";
import { countries, getDb, stations, stores } from "@/blocks/data";

/** Строка экрана «Чек-листы»: где чек-лист живёт, когда открывается и в каком он состоянии. */
export interface ChecklistRow {
  id: string;
  title: LocalizedText;
  windowStart: string;
  windowEnd: string;
  stationName: string | null;
  storeName: string | null;
  countryName: string | null;
  publishedNumber: number | null;
  hasDraft: boolean;
  itemCount: number;
  submissions7d: number;
}

/** Станция в выпадающем списке свойств чек-листа. */
export interface StationOption {
  id: string;
  name: string;
  storeName: string;
  countryName: string;
}

// Индексная сигнатура — требование db.execute (см. drafts.ts).
interface ChecklistListRow extends Record<string, unknown> {
  id: string;
  title: LocalizedText;
  window_start: string;
  window_end: string;
  station_name: string | null;
  store_name: string | null;
  country_name: string | null;
  published_number: number | null;
  has_draft: boolean;
  item_count: string;
  submissions_7d: string;
}

// Окно недавних заполнений на экране списка: столбец «за 7 дней» из эталона.
const RECENT_DAYS = 7;

/**
 * Все чек-листы, сгруппированные по пути «страна → пиццерия → станция».
 *
 * Пунктов считается столько, сколько их в опубликованной версии, а если её ещё нет —
 * в черновике: методисту нужен размер того, что видит сотрудник, а до первой публикации —
 * того, что он набрал.
 */
export async function listChecklists(): Promise<ChecklistRow[]> {
  const rows = await getDb().execute<ChecklistListRow>(sql`
    select c.id::text as id, c.title, c.window_start, c.window_end,
           st.name as station_name, sto.name as store_name, co.name as country_name,
           (select v.version_number from checklist_versions v
             where v.checklist_id = c.id and v.status = 'published') as published_number,
           exists (select 1 from checklist_versions v
                    where v.checklist_id = c.id and v.status = 'draft') as has_draft,
           (select coalesce(sum(jsonb_array_length(s->'items')), 0)
              from checklist_versions v
              cross join lateral jsonb_array_elements(v.sections) s
             where v.id = coalesce(
                     (select p.id from checklist_versions p
                       where p.checklist_id = c.id and p.status = 'published'),
                     (select d.id from checklist_versions d
                       where d.checklist_id = c.id and d.status = 'draft'))) as item_count,
           (select count(*) from submissions sub
              join checklist_versions v on v.id = sub.version_id
             where v.checklist_id = c.id
               and sub.submitted_at >= now() - ${`${String(RECENT_DAYS)} days`}::interval) as submissions_7d
      from checklists c
      left join stations st on st.id = c.station_id
      left join stores sto on sto.id = st.store_id
      left join countries co on co.id = sto.country_id
     order by co.name nulls last, sto.name nulls last, st.name nulls last,
              coalesce(c.title->>'ru', c.title->>'en') nulls last, c.created_at`);

  return rows.rows.map((row) => ({
    id: row.id,
    title: row.title,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    stationName: row.station_name,
    storeName: row.store_name,
    countryName: row.country_name,
    publishedNumber: row.published_number,
    hasDraft: row.has_draft,
    itemCount: Number(row.item_count),
    submissions7d: Number(row.submissions_7d),
  }));
}

/** Станции для выбора в свойствах чек-листа, в порядке «страна → пиццерия → станция». */
export async function listStations(): Promise<StationOption[]> {
  return await getDb()
    .select({
      id: stations.id,
      name: stations.name,
      storeName: stores.name,
      countryName: countries.name,
    })
    .from(stations)
    .innerJoin(stores, sql`${stores.id} = ${stations.storeId}`)
    .innerJoin(countries, sql`${countries.id} = ${stores.countryId}`)
    .orderBy(asc(countries.name), asc(stores.name), asc(stations.name));
}
