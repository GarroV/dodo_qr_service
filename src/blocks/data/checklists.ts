// Чек-листы и их версии: черновик, публикация и выбор версии для станции.
//
// Публикация — вставка строки, никогда не переписывание. Прежняя опубликованная версия
// уходит в архив сменой одного признака: её содержимое остаётся тем же, потому что на неё
// ссылаются заполнения (принцип 3, D002).
import { and, asc, eq, sql } from "drizzle-orm";

import { getDb } from "./client";
import type { Checklist, ChecklistVersion, Station } from "./schema";
import { checklistVersions, checklists, stations } from "./schema";

/** Всё, что нужно экрану заполнения за один запрос: версия, её чек-лист и станция. */
export interface VersionWithChecklist {
  version: ChecklistVersion;
  checklist: Checklist;
  station: Station;
}

/**
 * Время суток для сравнения с окном чек-листа — в UTC.
 * Часового пояса у пиццерии в модели нет (окно вместо расписания, D004), а брать пояс
 * машины приложения значило бы получать разный ответ на разных площадках.
 */
function timeOfDayUtc(at: Date): string {
  return at.toISOString().slice(11, 19);
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
 * Окно полуоткрытое: начало включительно, конец исключительно, — и умеет переходить
 * через полночь (22:00–02:00). Неизвестный код станции даёт `null`: перебор кодов
 * не должен отличаться по ответу от промаха (D021).
 */
export async function getPublishedVersionForStation(
  stationCode: string,
  at: Date,
): Promise<VersionWithChecklist | null> {
  if (stationCode === "") return null;
  const time = timeOfDayUtc(at);

  const rows = await getDb()
    .select({
      version: checklistVersions,
      checklist: checklists,
      station: stations,
    })
    .from(stations)
    .innerJoin(checklists, eq(checklists.stationId, stations.id))
    .innerJoin(
      checklistVersions,
      and(
        eq(checklistVersions.checklistId, checklists.id),
        eq(checklistVersions.status, "published"),
      ),
    )
    .where(
      and(
        eq(stations.code, stationCode),
        sql`case
              when ${checklists.windowStart} <= ${checklists.windowEnd}
                then ${time}::time >= ${checklists.windowStart} and ${time}::time < ${checklists.windowEnd}
              else ${time}::time >= ${checklists.windowStart} or ${time}::time < ${checklists.windowEnd}
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
 * Публикует черновик чек-листа новой версией и возвращает её.
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
