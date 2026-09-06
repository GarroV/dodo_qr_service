// Проверка часового пояса пиццерии (T062). Пояс не украшение карточки: окно
// чек-листа сравнивается с местным временем пиццерии (D026), и перевод момента
// в зону делает сам PostgreSQL внутри выборки. Имя, которого он не знает, роняет
// эту выборку — то есть публичный маршрут ВСЕХ станций пиццерии, на каждом
// сканировании и молча до первого сканирования.
//
// Поэтому источник истины здесь — список зон самого PostgreSQL, а не `Intl`
// браузерного движка: падает именно база, и спрашивать надо у неё.
import { sql } from "drizzle-orm";

import { getDb } from "@/blocks/data";

import { CatalogError } from "./errors";

export interface TimezoneOption {
  /** Каноническое имя зоны, как его пишет PostgreSQL: `Asia/Almaty`. */
  name: string;
  /** Смещение для подписи в списке: `UTC+5`, `UTC-3:30`. */
  offset: string;
}

interface TimezoneCatalog {
  options: TimezoneOption[];
  /** Написание в нижнем регистре → каноническое: ввод приводится к одному виду. */
  canonical: Map<string, string>;
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PAD = 2;

// Список зон меняется только с обновлением PostgreSQL, то есть с перезапуском базы.
// Читать его на каждую правку пиццерии — полтысячи строк на ровном месте.
let cached: TimezoneCatalog | undefined;

function formatOffset(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "+";
  const absolute = Math.abs(totalSeconds);
  const hours = Math.floor(absolute / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (absolute % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const tail =
    minutes === 0 ? "" : `:${String(minutes).padStart(MINUTES_PAD, "0")}`;
  return `UTC${sign}${String(hours)}${tail}`;
}

async function loadCatalog(): Promise<TimezoneCatalog> {
  if (cached !== undefined) return cached;

  // `posix/…` и `right/…` — служебные копии тех же зон (вторые ещё и со скачущими
  // секундами координации). В справочник пиццерий им попадать незачем.
  const result = await getDb().execute<{ name: string; offset: string }>(
    sql`select name, extract(epoch from utc_offset)::text as offset
        from pg_timezone_names
        where name not like 'posix/%' and name not like 'right/%'`,
  );

  const options = result.rows
    .map((row) => ({
      name: row.name,
      offset: formatOffset(Number(row.offset)),
    }))
    // Порядок задаётся здесь, а не в `order by`: сортировка PostgreSQL идёт по байтам
    // и ставит `Etc/GMT+1` после `Etc/GMT-1`, а человеку нужен привычный алфавит.
    .sort((left, right) => left.name.localeCompare(right.name));

  cached = {
    options,
    canonical: new Map(
      options.map((zone) => [zone.name.toLowerCase(), zone.name]),
    ),
  };
  return cached;
}

/** Зоны для выпадающего списка формы пиццерии, по алфавиту. */
export async function listTimezones(): Promise<TimezoneOption[]> {
  return (await loadCatalog()).options;
}

/** Знает ли база такую зону. Пустое значение и мусор — не знает. */
export async function isKnownTimezone(name: string): Promise<boolean> {
  return (await loadCatalog()).canonical.has(name.trim().toLowerCase());
}

/**
 * Возвращает каноническое написание зоны или отказывает. Приведение к одному
 * написанию нужно потому, что PostgreSQL принимает `asia/almaty` в запросе,
 * а в справочнике две одинаковые пиццерии не должны выглядеть разными.
 */
export async function assertKnownTimezone(name: string): Promise<string> {
  const found = (await loadCatalog()).canonical.get(name.trim().toLowerCase());
  if (found === undefined) {
    throw new CatalogError(
      "unknownTimezone",
      `часовой пояс «${name}» база не знает: публичный маршрут станций такой пиццерии перестал бы открываться`,
    );
  }
  return found;
}
