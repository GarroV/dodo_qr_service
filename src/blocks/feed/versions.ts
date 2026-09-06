// Время публикации версии, по которой заполняли. Карточка подписывает им оговорку о
// снимке: «версия v2 от 14 августа» отвечает на вопрос «а что там было тогда».
//
// Запрос свой и узкий: `getSubmission` отдаёт номер версии, но не дату её публикации.
import { eq } from "drizzle-orm";

import { checklistVersions, getDb } from "@/blocks/data";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `null` для черновика, неизвестной версии и мусора вместо идентификатора. */
export async function versionPublishedAt(
  versionId: string,
): Promise<Date | null> {
  if (!UUID_PATTERN.test(versionId)) return null;

  const [row] = await getDb()
    .select({ publishedAt: checklistVersions.publishedAt })
    .from(checklistVersions)
    .where(eq(checklistVersions.id, versionId));

  return row?.publishedAt ?? null;
}
