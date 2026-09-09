// Что публичный маршрут узнаёт по коду со наклейки — и ничего сверх этого (D021).
//
// Запросы свои, а не заказаны в блоке `data`: так устроены границы проекта (D024).
// Правило выбора версии по окну и часовому поясу при этом НЕ переписывается —
// оно живёт в `getPublishedVersionForStation`, и здесь только вызывается.
import { and, eq } from "drizzle-orm";

import type {
  Checklist,
  ChecklistVersion,
  Section,
  ShiftMode,
} from "@/blocks/data";
import {
  checklistVersions,
  countries,
  getDb,
  getPublishedVersionForStation,
  getShiftMode,
  sectionsForMode,
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
  /**
   * Пункты, отфильтрованные действующим режимом смены (D056). Полные секции версии
   * НЕ отдаются наружу: сотруднику показывается ровно то, что от него сегодня ждут,
   * а факт сокращения хранит снимок заполнения, а не этот экран.
   */
  readonly sections: Section[];
  readonly mode: ShiftMode;
  /**
   * Выбирал ли кто-нибудь режим на сегодня. `false` — работает полная смена по
   * умолчанию, и шапка говорит об этом ровно так же: сокращение обязано быть
   * видимым действием, а не догадкой по числу пунктов на экране.
   */
  readonly modeChosen: boolean;
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
  readonly storeId: string;
  readonly stationName: string;
  readonly storeName: string;
  readonly countryLocale: string;
}

/** Станция, её пиццерия и язык страны — ровно то, что попадёт на экран. */
async function stationContext(code: string): Promise<StationContext | null> {
  const [row] = await getDb()
    .select({
      storeId: stores.id,
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

  // Режим на сегодня, а если его никто не ставил — полная смена. Спрашивать первого
  // отсканировавшего нельзя: гейта на этом экране нет (D052), и первым подходит не
  // обязательно тот, кто знает график. Поэтому путь сотрудника остаётся прежним, а
  // сокращение делает тот, кто решает, — одним касанием по строке в шапке.
  const shift = await getShiftMode(context.storeId, at);
  const mode: ShiftMode = shift?.mode ?? "normal";

  const sections = sectionsForMode(found.version.sections, mode);
  // В этом режиме от станции сегодня не ждут ничего: честнее сказать «заполнять
  // нечего», чем открыть чек-лист без пунктов с активной кнопкой отправки.
  if (sections.length === 0) return NO_CHECKLIST;

  return {
    kind: "ok",
    version: found.version,
    checklist: found.checklist,
    sections,
    mode,
    modeChosen: shift?.chosen ?? false,
    stationName: context.stationName,
    storeName: context.storeName,
    countryLocale: context.countryLocale,
  };
}

/** Пиццерия станции по коду с наклейки: нужна, чтобы поставить ей режим смены. */
export async function storeIdForCode(code: string): Promise<string | null> {
  if (!isPlausibleCode(code)) return null;
  const context = await stationContext(code);
  return context?.storeId ?? null;
}

/** Версия, на которую пришло заполнение, — со снимком пунктов для проверки ответов. */
export interface StationVersion {
  readonly versionId: string;
  readonly stationId: string;
  /** Пиццерия станции: по ней читается действующий режим смены (D055). */
  readonly storeId: string;
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
      storeId: stations.storeId,
      sections: checklistVersions.sections,
    })
    .from(checklistVersions)
    .innerJoin(stations, eq(checklistVersions.stationId, stations.id))
    .where(and(eq(checklistVersions.id, versionId), eq(stations.code, code)))
    .limit(1);

  return row ?? null;
}
