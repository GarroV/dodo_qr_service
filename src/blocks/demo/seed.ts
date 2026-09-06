// Сид демонстрационного контура: один прогон приводит базу к состоянию, которое
// можно показывать (T049).
//
// Идемпотентность здесь устроена не «посмотреть и досоздать недостающее», а
// «снять своё и завести заново». Досоздание требует сравнивать содержимое каждой
// строки с описанием и разбирать частичные расхождения — а это ровно тот код,
// который тихо расходится с данными. Опознаватели контура постоянны (см. model.ts),
// поэтому снятие точечное: чужой строки сид не касается ни одной.
import { eq, inArray, or } from "drizzle-orm";

import type { Answer, Database, Section } from "@/blocks/data";
import {
  blocks,
  checklistVersions,
  checklists,
  countries,
  getDb,
  stations,
  stores,
  submissions,
} from "@/blocks/data";

import { DEMO } from "./dataset";
import type { DemoDataset } from "./model";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export interface DemoStationCode {
  readonly station: string;
  readonly store: string;
  readonly code: string;
}

/** Что сид сделал: печатается запускающим и годится для проверки глазами. */
export interface DemoSeedSummary {
  readonly removedRows: number;
  readonly country: string;
  readonly stores: number;
  readonly stations: number;
  readonly blocks: number;
  readonly checklists: number;
  readonly versions: number;
  readonly submissions: number;
  readonly codes: readonly DemoStationCode[];
}

export interface SeedOptions {
  /**
   * Опорный момент: заполнения и публикации датируются смещением назад от него.
   * Задаётся в тестах, чтобы два прогона можно было сравнить строка в строку.
   */
  readonly now?: Date;
  readonly dataset?: DemoDataset;
}

function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * HOUR_MS);
}

/**
 * Моменты ответов внутри заполнения: равномерно от начала до отправки.
 * Последний ответ приходится ровно на отправку — так же, как это выглядит в жизни:
 * сотрудник отвечает на последний пункт и нажимает кнопку.
 */
function withAnswerTimes(
  answers: readonly Omit<Answer, "at">[],
  startedAt: Date,
  durationMs: number,
): Answer[] {
  return answers.map((answer, index) => ({
    ...answer,
    at:
      startedAt.getTime() +
      Math.round(((index + 1) * durationMs) / answers.length),
  }));
}

/** Транзакция слоя доступа: тип берётся у самого `transaction`, чтобы не разъехаться с ним. */
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Снимает прошлый контур. Порядок обратный вставке: сначала то, что ссылается,
 * потом то, на что ссылаются, — иначе внешний ключ не даст удалить.
 */
async function removeContour(
  tx: Transaction,
  data: DemoDataset,
): Promise<number> {
  const stationIds = data.stations.map((station) => station.id);
  const storeIds = data.stores.map((store) => store.id);
  const checklistIds = data.checklists.map((checklist) => checklist.id);
  const blockIds = data.blocks.map((block) => block.id);
  const submissionIds = data.submissions.map((submission) => submission.id);

  if (stationIds.length === 0 || checklistIds.length === 0) {
    throw new Error(
      "Описание контура без станций или чек-листов: заводить и снимать нечего",
    );
  }

  // Заполнения снимаются и по станции контура, а не только по своему опознавателю:
  // на показе по демо-коду заполняют по-настоящему, и такие записи держали бы версию
  // внешним ключом — повторный прогон падал бы вместо того, чтобы обновить контур.
  const removedSubmissions = await tx
    .delete(submissions)
    .where(
      or(
        inArray(submissions.stationId, stationIds),
        ...(submissionIds.length > 0
          ? [inArray(submissions.id, submissionIds)]
          : []),
      ),
    )
    .returning({ id: submissions.id });

  const removedVersions = await tx
    .delete(checklistVersions)
    .where(inArray(checklistVersions.checklistId, checklistIds))
    .returning({ id: checklistVersions.id });

  const removedChecklists = await tx
    .delete(checklists)
    .where(inArray(checklists.id, checklistIds))
    .returning({ id: checklists.id });

  const removedStations = await tx
    .delete(stations)
    .where(inArray(stations.id, stationIds))
    .returning({ id: stations.id });

  const removedStores =
    storeIds.length === 0
      ? []
      : await tx
          .delete(stores)
          .where(inArray(stores.id, storeIds))
          .returning({ id: stores.id });

  const removedCountry = await tx
    .delete(countries)
    .where(eq(countries.id, data.country.id))
    .returning({ id: countries.id });

  const removedBlocks =
    blockIds.length === 0
      ? []
      : await tx
          .delete(blocks)
          .where(inArray(blocks.id, blockIds))
          .returning({ id: blocks.id });

  return [
    removedSubmissions,
    removedVersions,
    removedChecklists,
    removedStations,
    removedStores,
    removedCountry,
    removedBlocks,
  ].reduce((total, rows) => total + rows.length, 0);
}

async function insertContour(
  tx: Transaction,
  data: DemoDataset,
  now: Date,
): Promise<void> {
  await tx.insert(countries).values({
    id: data.country.id,
    name: data.country.name,
    locale: data.country.locale,
  });
  await tx.insert(stores).values(
    data.stores.map((store) => ({
      id: store.id,
      countryId: data.country.id,
      name: store.name,
      timezone: store.timezone,
    })),
  );
  await tx.insert(stations).values(
    data.stations.map((station) => ({
      id: station.id,
      storeId: station.storeId,
      name: station.name,
      code: station.code,
    })),
  );
  if (data.blocks.length > 0) {
    await tx.insert(blocks).values(
      data.blocks.map((block) => ({
        id: block.id,
        title: block.title,
        items: [...block.items],
      })),
    );
  }
  await tx.insert(checklists).values(
    data.checklists.map((checklist) => ({
      id: checklist.id,
      stationId: checklist.stationId,
      title: checklist.title,
      windowStart: checklist.window.start,
      windowEnd: checklist.window.end,
    })),
  );

  await tx.insert(checklistVersions).values([
    // Черновик методиста: он живёт рядом с опубликованной версией и правится дальше.
    ...data.checklists.map((checklist) => ({
      id: checklist.draft.id,
      checklistId: checklist.id,
      status: "draft" as const,
      versionNumber: null,
      stationId: null,
      sections: [...checklist.draft.sections],
      publishedAt: null,
    })),
    ...data.checklists.flatMap((checklist) =>
      checklist.versions.map((version) => ({
        id: version.id,
        checklistId: checklist.id,
        status: version.status,
        versionNumber: version.versionNumber,
        // Станция замораживается в версии так же, как это делает публикация.
        stationId: checklist.stationId,
        sections: [...version.sections],
        publishedAt: hoursBefore(now, version.publishedHoursAgo),
      })),
    ),
  ]);

  const sectionsByVersion = new Map<string, Section[]>(
    data.checklists.flatMap((checklist) =>
      checklist.versions.map(
        (version) => [version.id, [...version.sections]] as const,
      ),
    ),
  );

  await tx.insert(submissions).values(
    data.submissions.map((submission) => {
      const submittedAt = hoursBefore(now, submission.submittedHoursAgo);
      const durationMs = submission.durationMinutes * MINUTE_MS;
      const startedAt = new Date(submittedAt.getTime() - durationMs);
      const snapshot = sectionsByVersion.get(submission.versionId);
      if (snapshot === undefined) {
        throw new Error(
          `Заполнение ${submission.id} ссылается на версию ${submission.versionId}, которой нет в описании контура`,
        );
      }
      return {
        id: submission.id,
        versionId: submission.versionId,
        stationId: submission.stationId,
        // Снимок — это разметка той версии, что была отдана на станцию (D002).
        snapshot,
        answers: withAnswerTimes(submission.answers, startedAt, durationMs),
        startedAt,
        submittedAt,
      };
    }),
  );
}

/**
 * Приводит базу к демонстрационному контуру. Повторный прогон возвращает контур
 * в исходное состояние: снимает всё своё (включая заполнения, сделанные на демо-станциях
 * по ходу показа) и заводит заново.
 *
 * Всё одной транзакцией: прерванный сид не имеет права оставить базу с половиной
 * контура — показывать такое хуже, чем не показывать ничего.
 */
export async function seedDemo(
  options: SeedOptions = {},
): Promise<DemoSeedSummary> {
  const data = options.dataset ?? DEMO;
  const now = options.now ?? new Date();

  const removedRows = await getDb().transaction(async (tx) => {
    const removed = await removeContour(tx, data);
    await insertContour(tx, data, now);
    return removed;
  });

  const storeNames = new Map(
    data.stores.map((store) => [store.id, store.name]),
  );

  return {
    removedRows,
    country: data.country.name,
    stores: data.stores.length,
    stations: data.stations.length,
    blocks: data.blocks.length,
    checklists: data.checklists.length,
    versions:
      data.checklists.length +
      data.checklists.reduce(
        (total, checklist) => total + checklist.versions.length,
        0,
      ),
    submissions: data.submissions.length,
    codes: data.stations.map((station) => ({
      station: station.name,
      store: storeNames.get(station.storeId) ?? "",
      code: station.code,
    })),
  };
}
