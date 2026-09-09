// Разбор текста, вставленного из буфера обмена, в пункты чек-листа (T021).
// Методист копирует список из Word/Excel/заметок и вставляет в редактор одним действием:
// двадцать строк буфера обязаны стать двадцатью пунктами за один вызов parsePastedList.
import type { Item, LocalizedText } from "@/blocks/data";

// Разделители строк буфера: \r\n и одиночные \n/\r — обычные переводы строки;
// \v (U+000B) — мягкий перенос, который вставляет Word; \u2028 (разделитель строки)
// и \u2029 (разделитель абзаца) — то, что оставляют браузеры при вставке из некоторых
// редакторов. Экранируем их \u-последовательностью: как литерал строки такой символ
// был бы допустим (JSON Superset, ES2019), но внутри regex-литерала он обрывает токен.
// \r\n — самая длинная альтернатива, поэтому стоит первой: иначе движок разберёт её
// как одиночный \r, а второй символ \n даст лишнюю пустую строку.
const LINE_SPLIT_PATTERN = /\r\n|[\n\r\v\u2028\u2029]/;

// Неразрывный пробел (U+00A0): Word вставляет его вместо обычного пробела.
const NON_BREAKING_SPACE = " ";

// Табуляции и повторы пробелов внутри строки схлопываются в один пробел.
const REPEATED_WHITESPACE = /[\t ]+/g;

// Маркеры списка перед пробелом/табом (уже схлопнутым в один пробел к моменту проверки).
const BULLET_CHARS = "\\-–—*•·‣▪◦+»";
const BULLET_MARKER = new RegExp(`^[${BULLET_CHARS}] `);
// Строка из одного маркера без текста («-», «•») по смыслу пуста: сам маркер не пункт.
const BULLET_ONLY = new RegExp(`^[${BULLET_CHARS}]$`);

// Нумерация: "1.", "2)", "1.1.", "1.2.3)", "(4)", "[5]" — цифры с завершающей точкой
// или скобкой перед пробелом. Число без такого завершения маркером не считается —
// "5 кг теста" не должно потерять "5": литерал [.)] в конце обязателен.
const NUMBERING_TOKEN = String.raw`(?:\(\d+\)|\[\d+\]|\d+(?:\.\d+)*[.)])`;
const NUMBERING_MARKER = new RegExp(`^${NUMBERING_TOKEN} `);
const NUMBERING_ONLY = new RegExp(`^${NUMBERING_TOKEN}$`);

// Чекбокс Markdown после маркера списка: "- [ ] Текст", "- [x] Текст" → "Текст".
const CHECKBOX_MARKER = /^\[[ xX]\] /;

// Элемент 0 у RegExpExecArray типизирован в lib.es5.d.ts как обязательный `string`
// (это сам факт совпадения) — noUncheckedIndexedAccess его не затрагивает.
function matchedLength(match: RegExpExecArray): number {
  return match[0].length;
}

/** Схлопывает табы/пробелы/неразрывные пробелы строки в один пробел и обрезает края. */
function collapseWhitespace(line: string): string {
  return line
    .replaceAll(NON_BREAKING_SPACE, " ")
    .replace(REPEATED_WHITESPACE, " ")
    .trim();
}

/** Отбрасывает нумерацию или маркер списка в начале строки, если за ним идёт пробел. */
function stripListMarker(line: string): string {
  const numbering = NUMBERING_MARKER.exec(line);
  if (numbering !== null) return line.slice(matchedLength(numbering));

  const bullet = BULLET_MARKER.exec(line);
  if (bullet !== null) return line.slice(matchedLength(bullet));

  return line;
}

/** Отбрасывает чекбокс Markdown "[ ]"/"[x]" в начале строки, если за ним идёт пробел. */
function stripCheckboxMarker(line: string): string {
  const checkbox = CHECKBOX_MARKER.exec(line);
  return checkbox === null ? line : line.slice(matchedLength(checkbox));
}

/** Строка целиком — маркер без текста: одинокое тире, одинокая нумерация. */
function isMarkerOnly(line: string): boolean {
  return BULLET_ONLY.test(line) || NUMBERING_ONLY.test(line);
}

/** Одна строка вставленного списка после снятия маркеров, либо "" — строку пропустить. */
function normalizeLine(rawLine: string): string {
  const collapsed = collapseWhitespace(rawLine);
  if (collapsed === "" || isMarkerOnly(collapsed)) return "";
  return stripCheckboxMarker(stripListMarker(collapsed)).trim();
}

/** Строки списка из буфера: маркеры и нумерация отброшены, пустые строки пропущены. */
export function parsePastedLines(text: string): string[] {
  return text
    .split(LINE_SPLIT_PATTERN)
    .map((rawLine) => normalizeLine(rawLine))
    .filter((line) => line !== "");
}

/**
 * Пункты чек-листа из вставленного списка. Заголовок пишется под ключ языка `locale`
 * (интерфейс редактора двуязычный: "ru" | "en"); тип ответа "bool", уровень «обычный».
 */
export function parsePastedList(text: string, locale: string): Item[] {
  return parsePastedLines(text).map((line) => {
    const title: LocalizedText = { [locale]: line };
    return {
      id: crypto.randomUUID(),
      title,
      type: "bool",
      severity: "normal",
    };
  });
}
