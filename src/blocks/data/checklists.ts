// Чек-листы и их версии: черновик, публикация и выбор версии для станции.
//
// Публикация — вставка строки, никогда не переписывание. Прежняя опубликованная версия
// уходит в архив сменой одного признака: её содержимое остаётся тем же, потому что на неё
// ссылаются заполнения (принцип 3, D002).
import { and, asc, eq, sql } from "drizzle-orm";

import { getDb } from "./client";
import type { Checklist, ChecklistVersion, Station } from "./schema";
import { checklistVersions, checklists, stations, stores } from "./schema";

/** Всё, что нужно экрану заполнения за один запрос: версия, её чек-лист и станция. */
export interface VersionWithChecklist {
  version: ChecklistVersion;
  checklist: Checklist;
  station: Station;
}

export async function getDraft(
  checklistId: string,
): Promise<ChecklistVersion | null> {
  const rows = await getDb()
    .select()
    .from(checklistVersions)
    .where(
      and(
        eq(checklistVersions.checklistId, checklistId),
        eq(checklistVersions.status, "draft"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Опубликованная версия чек-листа станции, подходящая по времени.
 *
 * Время сравнивается **местное для пиццерии**: момент `at` переводится в часовой пояс
 * пиццерии, и только потом сопоставляется с окном. Иначе утренний чек-лист в стране
 * с большим сдвигом открывался бы среди дня.
 *
 * Окно полуоткрытое: начало включительно, конец исключительно, — и умеет переходить
 * через полночь (22:00–02:00). Неизвестный код станции даёт `null`: перебор кодов
 * не должен отличаться по ответу от промаха (D021).
 */
export async function getPublishedVersionForStation(
  stationCode: string,
  at: Date,
): Promise<VersionWithChecklist | null> {
  if (stationCode === "") return null;

  const localTime = sql`(${at.toISOString()}::timestamptz at time zone ${stores.timezone})::time`;

  const rows = await getDb()
    .select({
      version: checklistVersions,
      checklist: checklists,
      station: stations,
    })
    .from(stations)
    .innerJoin(stores, eq(stations.storeId, stores.id))
    .innerJoin(checklists, eq(checklists.stationId, stations.id))
    .innerJoin(
      checklistVersions,
      and(
        eq(checklistVersions.checklistId, checklists.id),
        eq(checklistVersions.status, "published"),
        // Версия принадлежит станции, для которой опубликована: её станция заморожена
        // в момент публикации и здесь обязана совпасть со сканируемой. Иначе после
        // переноса чек-листа станция отдавала бы чужую версию, а заполнение уходило
        // бы в историю прежней станции (T056).
        eq(checklistVersions.stationId, stations.id),
      ),
    )
    .where(
      and(
        eq(stations.code, stationCode),
        sql`case
              when ${checklists.windowStart} <= ${checklists.windowEnd}
                then ${localTime} >= ${checklists.windowStart} and ${localTime} < ${checklists.windowEnd}
              else ${localTime} >= ${checklists.windowStart} or ${localTime} < ${checklists.windowEnd}
            end`,
      ),
    )
    // Если станции назначены два подходящих чек-листа, берётся начинающийся раньше:
    // ответ должен быть один и тот же при каждом сканировании.
    .orderBy(asc(checklists.windowStart))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Публикует черновик чек-листа новой версией и возвращает её. Вместе с содержимым
 * замораживается станция чек-листа: версия принадлежит той станции, для которой
 * опубликована, и перенос чек-листа задним числом её не переписывает.
 * Черновик остаётся на месте: методист продолжает править его дальше, а правка
 * переиспользуемого блока приходит в черновики и не трогает опубликованное (D011).
 *
 * Одновременные публикации разводит блокировка строки черновика: вторая ждёт первую
 * и получает следующий номер, а не вторую активную версию.
 */
export async function publishVersion(
  checklistId: string,
): Promise<ChecklistVersion> {
  return getDb().transaction(async (tx) => {
    const draftRows = await tx
      .select()
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.checklistId, checklistId),
          eq(checklistVersions.status, "draft"),
        ),
      )
      .limit(1)
      .for("update");
    const draft = draftRows[0];
    if (draft === undefined) {
      throw new Error(
        `У чек-листа ${checklistId} нет черновика: публиковать нечего`,
      );
    }

    // Станция чек-листа замораживается вместе с содержимым: она читается здесь,
    // в транзакции публикации, и больше у этой версии не меняется (T056).
    const checklistRows = await tx
      .select({ stationId: checklists.stationId })
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);
    const checklist = checklistRows[0];
    if (checklist === undefined) {
      throw new Error(`Чек-листа ${checklistId} нет: публиковать нечего`);
    }

    const numbers = await tx
      .select({
        highest: sql<number | null>`max(${checklistVersions.versionNumber})`,
      })
      .from(checklistVersions)
      .where(eq(checklistVersions.checklistId, checklistId));
    const nextNumber = (numbers[0]?.highest ?? 0) + 1;

    // Единственное изменение прежней версии за всю её жизнь — этот признак.
    await tx
      .update(checklistVersions)
      .set({ status: "archived" })
      .where(
        and(
          eq(checklistVersions.checklistId, checklistId),
          eq(checklistVersions.status, "published"),
        ),
      );

    const inserted = await tx
      .insert(checklistVersions)
      .values({
        checklistId,
        status: "published",
        versionNumber: nextNumber,
        stationId: checklist.stationId,
        sections: draft.sections,
        // Время публикации — серверное: клиентским отметкам времени веры нет.
        publishedAt: sql`now()`,
      })
      .returning();
    const published = inserted[0];
    if (published === undefined) {
      throw new Error("Версия не вставилась: публикация не состоялась");
    }
    return published;
  });
}
