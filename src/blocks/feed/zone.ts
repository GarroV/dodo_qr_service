// Часовые пояса ленты. Заполнение происходит на кухне, а не на сервере: сотрудник
// видел на телефоне местное время пиццерии, и управляющий обязан видеть то же самое.
// Поэтому «сегодня» и время строки считаются в поясе, а не в UTC и не в поясе машины.

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Смещение GMT±ЧЧ:ММ или голое GMT для нулевого смещения. */
const OFFSET_PATTERN = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/;

export interface DayParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Смещение пояса в миллисекундах В ЭТОТ момент времени.
 *
 * Считается через `Intl`, а не таблицей смещений: переход на летнее время и переносы
 * поясов (Казахстан переводил часы в 2024-м) живут в базе часовых поясов системы,
 * а собственная таблица устаревала бы молча.
 */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = OFFSET_PATTERN.exec(name);
  if (match === null) return 0;

  const [, sign, hours, minutes] = match;
  if (sign === undefined || hours === undefined || minutes === undefined) {
    return 0;
  }

  const magnitude = Number(hours) * HOUR_MS + Number(minutes) * MINUTE_MS;
  return sign === "-" ? -magnitude : magnitude;
}

/** Год, месяц и день в поясе: 21:00 UTC в Алматы — это уже следующее утро. */
export function zonedDayParts(at: Date, timeZone: string): DayParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: value("year"), month: value("month"), day: value("day") };
}

/**
 * Момент, с которого начинаются местные сутки этой даты.
 *
 * Смещение берётся дважды: сначала в исходный момент, затем в найденной полуночи.
 * Один проход ошибается на сутках перехода — в день, когда часы переводят в 02:00,
 * полуденное смещение уже летнее, а полночь наступила ещё по зимнему.
 */
export function zonedDayStart(at: Date, timeZone: string): Date {
  const { year, month, day } = zonedDayParts(at, timeZone);
  const naive = Date.UTC(year, month - 1, day);

  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);
  return new Date(naive - zoneOffsetMs(new Date(firstGuess), timeZone));
}
