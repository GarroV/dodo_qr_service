// Данные для тестов. Каждый тест заводит свои строки с уникальными именами и кодами:
// файлы тестов идут параллельно, общая очистка таблиц между ними ломала бы соседа.
import { randomUUID } from "node:crypto";

import {
  checklistVersions,
  checklists,
  countries,
  stations,
  stores,
} from "../schema";
import type { Section } from "../types";
import { getTestDb } from "./db";

const STATION_CODE_LENGTH = 10;

function firstRow<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`Строка не вставилась: ${what}`);
  return row;
}

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function uniqueStationCode(): string {
  return randomUUID().replaceAll("-", "").slice(0, STATION_CODE_LENGTH);
}

export interface StationFixture {
  countryId: string;
  storeId: string;
  stationId: string;
  stationCode: string;
}

/** Страна → пиццерия → станция: минимальная цепочка, к которой цепляется чек-лист. */
export async function createStation(): Promise<StationFixture> {
  const db = getTestDb();
  const suffix = uniqueSuffix();
  const country = firstRow(
    await db
      .insert(countries)
      .values({ name: `Страна ${suffix}`, locale: "ru" })
      .returning({ id: countries.id }),
    "countries",
  );
  const store = firstRow(
    await db
      .insert(stores)
      .values({ countryId: country.id, name: `Пиццерия ${suffix}` })
      .returning({ id: stores.id }),
    "stores",
  );
  const code = uniqueStationCode();
  const station = firstRow(
    await db
      .insert(stations)
      .values({ storeId: store.id, name: `Станция ${suffix}`, code })
      .returning({ id: stations.id }),
    "stations",
  );

  return {
    countryId: country.id,
    storeId: store.id,
    stationId: station.id,
    stationCode: code,
  };
}

export interface ChecklistOptions {
  stationId?: string | null;
  windowStart?: string;
  windowEnd?: string;
  title?: Record<string, string>;
}

export async function createChecklist(
  options: ChecklistOptions = {},
): Promise<string> {
  const db = getTestDb();
  const suffix = uniqueSuffix();
  const checklist = firstRow(
    await db
      .insert(checklists)
      .values({
        stationId: options.stationId ?? null,
        title: options.title ?? {
          ru: `Чек-лист ${suffix}`,
          en: `Checklist ${suffix}`,
        },
        windowStart: options.windowStart ?? "06:00:00",
        windowEnd: options.windowEnd ?? "12:00:00",
      })
      .returning({ id: checklists.id }),
    "checklists",
  );
  return checklist.id;
}

/** Секция с одним пунктом: достаточно, чтобы отличать содержимое версий друг от друга. */
export function sampleSections(label: string): Section[] {
  return [
    {
      id: `section-${label}`,
      title: { ru: `Секция ${label}`, en: `Section ${label}` },
      source: "own",
      items: [
        {
          id: `item-${label}`,
          title: { ru: `Пункт ${label}`, en: `Item ${label}` },
          type: "bool",
          critical: true,
        },
      ],
    },
  ];
}

export async function createDraft(
  checklistId: string,
  sections: Section[],
): Promise<string> {
  const db = getTestDb();
  const draft = firstRow(
    await db
      .insert(checklistVersions)
      .values({ checklistId, status: "draft", sections })
      .returning({ id: checklistVersions.id }),
    "checklist_versions",
  );
  return draft.id;
}
