// Удаление чек-листа. Ведёт себя по-разному, и это не деталь реализации, а продуктовое
// правило: заполнения не исчезают никогда (принцип 3, D002).
//
// Нет заполнений — чек-лист стирается целиком вместе с версиями: методист завёл лишнее или
// ошибся, и держать это в списке незачем.
// Есть заполнения — стереть нечего: каждое заполнение ссылается на версию и хранит снимок
// пунктов, который сотрудник видел в момент отправки. База это и не даст (`on delete restrict`),
// но дело не в ограничении: лента показала бы историю, ведущую в никуда. Такой чек-лист
// снимается с работы — уходит из списка и перестаёт открываться на станции.
//
// Разницу видит методист: экран подтверждения говорит заранее, что именно произойдёт, —
// «удалить» и «убрать из работы» слишком разные вещи, чтобы выясняться после нажатия.
import { and, eq, isNull, sql } from "drizzle-orm";

import type { LocalizedText } from "@/blocks/data";
import { checklistVersions, checklists, getDb } from "@/blocks/data";

import { EditorInputError, isUuid } from "./validation";

/** Что произошло с чек-листом: стёрт целиком или снят с работы с сохранением истории. */
export type RemovalOutcome = "deleted" | "archived";

/** Сколько заполнений накопил чек-лист и снят ли он уже с работы. */
export interface RemovalPreview {
  readonly submissionCount: number;
  readonly archived: boolean;
  /** Что произойдёт при подтверждении — тот же выбор, что сделает `removeChecklist`. */
  readonly outcome: RemovalOutcome;
  /** Название: экран подтверждения обязан назвать то, что удаляет. */
  readonly title: LocalizedText;
}

function requireId(checklistId: string): string {
  if (!isUuid(checklistId)) {
    throw new EditorInputError(
      "notFound",
      `Идентификатор чек-листа не читается: ${checklistId}`,
    );
  }
  return checklistId;
}

async function countSubmissions(
  db: ReturnType<typeof getDb>,
  checklistId: string,
): Promise<number> {
  const rows = await db.execute<{ count: string }>(sql`
    select count(*) as count
      from submissions sub
      join checklist_versions v on v.id = sub.version_id
     where v.checklist_id = ${checklistId}`);
  return Number(rows.rows[0]?.count ?? 0);
}

/**
 * Что случится с чек-листом при удалении — до того, как методист нажал кнопку.
 * Отдельная функция, а не флаг внутри удаления: экран подтверждения обязан показать
 * последствие заранее, и показывать он должен ровно тот выбор, который потом произойдёт.
 */
export async function previewRemoval(
  checklistId: string,
): Promise<RemovalPreview> {
  const id = requireId(checklistId);
  const db = getDb();

  const rows = await db
    .select({ archivedAt: checklists.archivedAt, title: checklists.title })
    .from(checklists)
    .where(eq(checklists.id, id));
  const row = rows[0];
  if (row === undefined) {
    throw new EditorInputError("notFound", `Чек-листа ${id} нет`);
  }

  const submissionCount = await countSubmissions(db, id);
  return {
    submissionCount,
    archived: row.archivedAt !== null,
    outcome: submissionCount > 0 ? "archived" : "deleted",
    title: row.title,
  };
}

/**
 * Удаляет чек-лист или снимает его с работы — смотря есть ли заполнения.
 *
 * Всё одной транзакцией: подсчёт заполнений и удаление версий обязаны видеть одно и то же
 * состояние. Иначе заполнение, пришедшее между подсчётом и удалением, упёрлось бы в
 * `on delete restrict` уже после того, как часть версий стёрта.
 */
export async function removeChecklist(
  checklistId: string,
): Promise<RemovalOutcome> {
  const id = requireId(checklistId);

  return getDb().transaction(async (tx) => {
    // Блокировка строки чек-листа: два одновременных удаления не должны стирать версии наполовину.
    const locked = await tx.execute<{ archived_at: Date | null }>(sql`
      select archived_at from checklists where id = ${id} for update`);
    const row = locked.rows[0];
    if (row === undefined) {
      throw new EditorInputError("notFound", `Чек-листа ${id} нет`);
    }

    if (await hasSubmissions(tx, id)) {
      // Повторное удаление не переписывает время снятия: методист не должен терять,
      // когда чек-лист ушёл из работы, только потому что нажал кнопку дважды.
      await tx
        .update(checklists)
        .set({ archivedAt: sql`now()` })
        .where(and(eq(checklists.id, id), isNull(checklists.archivedAt)));
      return "archived";
    }

    await tx
      .delete(checklistVersions)
      .where(eq(checklistVersions.checklistId, id));
    await tx.delete(checklists).where(eq(checklists.id, id));
    return "deleted";
  });
}

async function hasSubmissions(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  checklistId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    select exists (
      select 1 from submissions sub
        join checklist_versions v on v.id = sub.version_id
       where v.checklist_id = ${checklistId}) as exists`);
  return rows.rows[0]?.exists === true;
}
