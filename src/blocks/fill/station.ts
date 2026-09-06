// Что публичный маршрут узнаёт по коду со наклейки — и ничего сверх этого (D021).
//
// Запросы свои, а не заказаны в блоке `data`: так устроены границы проекта (D024).
// Правило выбора версии по окну и часовому поясу при этом НЕ переписывается —
// оно живёт в `getPublishedVersionForStation`, и здесь только вызывается.
import { and, eq } from "drizzle-orm";

import type { Checklist, ChecklistVersion, Section } from "@/blocks/data";
import {
  checklistVersions,
  countries,
  getDb,
  getPublishedVersionForStation,
  stations,
  stores,
} from "@/blocks/data";

/**
 * Границы кода до похода в базу. Алфавит кода ведёт блок `catalog`, и повторять его
 * здесь нельзя — он может смениться. Это не проверка формата, а заслон от заведомого
 * мусора: 64 знака и только буквы с цифрами. Всё, что длиннее или с посторонними
 * знаками, до запроса не доходит.
 */
const CODE_MAX_LENGTH = 64;
const CODE_SHAPE = /^[\dA-Za-z-]+$/;

const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function isPlausibleCode(code: string): boolean {
  return (
    code.length > 0 && code.length <= CODE_MAX_LENGTH && CODE_SHAPE.test(code)
  );
}

/** Открытая версия станции и минимум вокруг неё: название пиццерии и язык страны. */
interface FillTargetReady {
  readonly kind: "ok";
  readonly version: ChecklistVersion;
  readonly checklist: Checklist;
  readonly stationName: string;
  readonly storeName: string;
  readonly countryLocale: string;
}

/**
 * Три исхода сканирования, и различаются ровно два из них:
 * · `unknown-code` — такой станции нет. Так же выглядит перевыпущенный код: старой
 *   строки после перевыпуска не остаётся, и это к лучшему — перебор не отличит промах
 *   от «код был, но отозван».
 * · `no-checklist` — станция есть, но сейчас ей заполнять нечего. Отдельное состояние
 *   потому, что сотруднику с настоящей наклейкой надо сказать правду: бежать к
 *   управляющему за новой наклейкой не нужно. Данных этот ответ не несёт никаких.
 */
export type FillTarget =
  | FillTargetReady
  | { readonly kind: "unknown-code" }
  | { readonly kind: "no-checklist" };

const UNKNOWN_CODE = { kind: "unknown-code" } as const;
const NO_CHECKLIST = { kind: "no-checklist" } as const;

interface StationContext {
  readonly stationName: string;
  readonly storeName: string;
  readonly countryLocale: string;
}

/** Станция, её пиццерия и язык страны — ровно то, что попадёт на экран. */
async function stationContext(code: string): Promise<StationContext | null> {
  const [row] = await getDb()
    .select({
      stationName: stations.name,
      storeName: stores.name,
      countryLocale: countries.locale,
    })
    .from(stations)
    .innerJoin(stores, eq(stations.storeId, stores.id))
    .innerJoin(countries, eq(stores.countryId, countries.id))
    .where(eq(stations.code, code))
    .limit(1);

  return row ?? null;
}

/**
 * Всё, что отдаётся по отсканированной ссылке. Ни истории заполнений, ни списка
 * чек-листов станции, ни сведений о пиццерии сверх названия: ссылка публичная,
 * и любая лишняя строка в ответе — это то, что узнаёт любой, кто её подобрал (D021).
 */
export async function loadFillTarget(
  code: string,
  at: Date,
): Promise<FillTarget> {
  if (!isPlausibleCode(code)) return UNKNOWN_CODE;

  const context = await stationContext(code);
  if (context === null) return UNKNOWN_CODE;

  const found = await getPublishedVersionForStation(code, at);
  if (found === null) return NO_CHECKLIST;

  return {
    kind: "ok",
    version: found.version,
    checklist: found.checklist,
    stationName: context.stationName,
    storeName: context.storeName,
    countryLocale: context.countryLocale,
  };
}

/** Версия, на которую пришло заполнение, — со снимком пунктов для проверки ответов. */
export interface StationVersion {
  readonly versionId: string;
  readonly stationId: string;
  readonly sections: Section[];
}

/**
 * Версия по идентификатору — но только та, что заморожена на станции этого кода.
 *
 * Это и опора T041, и заслон: идентификатор версии приходит из браузера, то есть
 * от кого угодно. Без проверки принадлежности один живой код с наклейки позволял бы
 * писать заполнения в историю любой станции сети — `saveSubmission` выводит станцию
 * из версии и записал бы их туда, где никто не заполнял.
 *
 * Архивная версия проходит намеренно: сотрудник заполнял её, пока методист публиковал
 * следующую. Черновик не проходит — у него нет замороженной станции.
 */
export async function findStationVersion(
  code: string,
  versionId: string,
): Promise<StationVersion | null> {
  if (!isPlausibleCode(code)) return null;
  if (!UUID_PATTERN.test(versionId)) return null;

  const [row] = await getDb()
    .select({
      versionId: checklistVersions.id,
      stationId: stations.id,
      sections: checklistVersions.sections,
    })
    .from(checklistVersions)
    .innerJoin(stations, eq(checklistVersions.stationId, stations.id))
    .where(and(eq(checklistVersions.id, versionId), eq(stations.code, code)))
    .limit(1);

  return row ?? null;
}
