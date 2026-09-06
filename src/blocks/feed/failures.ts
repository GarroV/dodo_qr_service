// Сколько пунктов провалено в каждом заполнении.
//
// `listSubmissions` отдаёт только критичные провалы, а столбец «Результат» обязан
// отличать «всё выполнено» от «два пункта не выполнены». Поэтому строки ленты
// дочитываются по их же идентификаторам — вторым узким запросом по первичному ключу.
// Условия отбора здесь НЕ повторяются: какие заполнения попадают в ленту, решает
// по-прежнему только слой доступа, иначе два набора фильтров разъедутся.
//
// Правило провала берётся у `data` (`isFailed`), а не пишется заново: лента и карточка
// обязаны считать провал одинаково.
import { inArray } from "drizzle-orm";

import { flattenItems, getDb, isFailed, submissions } from "@/blocks/data";

/** Идентификатор → число проваленных пунктов (критичных и обычных вместе). */
export async function loadFailedCounts(
  ids: readonly string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const rows = await getDb()
    .select({
      id: submissions.id,
      snapshot: submissions.snapshot,
      answers: submissions.answers,
    })
    .from(submissions)
    .where(inArray(submissions.id, [...ids]));

  return new Map(
    rows.map((row) => {
      const byItem = new Map(
        row.answers.map((answer) => [answer.itemId, answer]),
      );
      const failed = flattenItems(row.snapshot).filter((item) =>
        isFailed(item, byItem.get(item.id)),
      ).length;
      return [row.id, failed];
    }),
  );
}
