// Вставленные блоки библиотеки внутри чек-листа (D011).
//
// В черновике секция блока хранится ссылкой `{ blockId }` — правка блока обязана приходить
// во все черновики, где он вставлен. Пункты рядом со ссылкой — снимок последнего обновления:
// он освежается при каждом сохранении и при публикации, а публикация уносит его в версию,
// которая уже не меняется никогда (D002, принцип 3).
//
// Своего экрана у библиотеки здесь нет: его строит блок `library`. Редактор только
// вставляет блок, показывает его пункты и разворачивает их в снимок.
import { inArray, sql } from "drizzle-orm";

import type { Item, LocalizedText, Section } from "@/blocks/data";
import { blocks, getDb } from "@/blocks/data";

import { isUuid } from "./validation";

/** Блок библиотеки в правой колонке редактора: что вставлять и где он уже используется. */
export interface LibraryEntry {
  id: string;
  title: LocalizedText;
  items: Item[];
  /** В скольких ДРУГИХ чек-листах этот блок уже вставлен — «используется ещё в 6». */
  usageCount: number;
}

// Индексная сигнатура — требование db.execute (см. drafts.ts).
interface BlockRow extends Record<string, unknown> {
  id: string;
  title: LocalizedText;
  items: Item[];
  usage_count: string;
}

/**
 * Опознаватели блоков, вставленных в разметку. Не-uuid отсеивается здесь: такой ссылки
 * в базе быть не может, а в запрос она уехала бы ошибкой драйвера вместо пустого ответа.
 */
export function linkedBlockIds(sections: readonly Section[]): string[] {
  const ids = new Set<string>();
  for (const section of sections) {
    if (typeof section.source !== "string" && isUuid(section.source.blockId)) {
      ids.add(section.source.blockId);
    }
  }
  return [...ids];
}

async function itemsByBlockId(
  ids: readonly string[],
): Promise<Map<string, Item[]>> {
  if (ids.length === 0) return new Map();

  // Запрос параметризованный: опознаватели пришли из браузера, и склеивать из них
  // текст запроса нельзя даже после проверки формата.
  const rows = await getDb()
    .select({ id: blocks.id, items: blocks.items })
    .from(blocks)
    .where(inArray(blocks.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.items]));
}

/**
 * Подставляет в секции-ссылки живые пункты блоков.
 *
 * Блока может уже не быть — тогда остаётся снимок, лежащий в самой секции: потерять
 * пункты чек-листа из-за удалённого блока хуже, чем показать их последнюю версию.
 */
export async function resolveLinkedSections(
  sections: readonly Section[],
): Promise<Section[]> {
  const ids = linkedBlockIds(sections);
  if (ids.length === 0) return [...sections];

  const items = await itemsByBlockId(ids);
  return sections.map((section) => {
    if (typeof section.source === "string") return section;
    const live = items.get(section.source.blockId);
    return live === undefined ? section : { ...section, items: live };
  });
}

/**
 * Блоки библиотеки со счётчиком использования. `exceptChecklistId` исключает текущий
 * чек-лист: на экране написано «используется ЕЩЁ в N чек-листах».
 */
export async function listLibrary(
  exceptChecklistId: string | null,
): Promise<LibraryEntry[]> {
  const except =
    exceptChecklistId !== null && isUuid(exceptChecklistId)
      ? exceptChecklistId
      : null;
  const rows = await getDb().execute<BlockRow>(sql`
    select b.id::text as id, b.title, b.items,
      (select count(distinct v.checklist_id)
         from checklist_versions v
        where (${except}::uuid is null or v.checklist_id <> ${except}::uuid)
          and exists (select 1
                        from jsonb_array_elements(v.sections) s
                       where s->'source'->>'blockId' = b.id::text)) as usage_count
      from blocks b
     order by b.created_at`);

  return rows.rows.map((row) => ({
    id: row.id,
    title: row.title,
    items: row.items,
    usageCount: Number(row.usage_count),
  }));
}
