// Код станции из публичной ссылки заполнения. Опознания у заполняющего нет (D001),
// поэтому код — единственное, что отделяет чужого от точки записи в базу (D021):
// он обязан быть неугадываемым, а не порядковым, и перевыпускаться в любой момент (D006).
import { randomBytes } from "node:crypto";

/**
 * Алфавит без похожих знаков: нет `0`/`O`, `1`/`l`/`I`. Код переписывают с наклейки
 * и диктуют по телефону — пара, которую человек путает, стоит дороже, чем один
 * лишний знак энтропии. Нижний регистр: код читается на наклейке и в адресной строке.
 */
export const STATION_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** 31^10 ≈ 8·10^14 сочетаний: перебор через публичный маршрут неосуществим. */
export const STATION_CODE_LENGTH = 10;

const BYTE_VALUES = 256;
// Наибольшее число байтовых значений, которое делится на длину алфавита нацело.
// Всё, что выше, отбрасывается: иначе `байт % 31` дал бы первым восьми знакам
// перевес в 12,5% и сузил бы перебор — при этом на глаз код выглядел бы прежним.
const UNBIASED_LIMIT =
  BYTE_VALUES - (BYTE_VALUES % STATION_CODE_ALPHABET.length);

function symbolAt(index: number): string {
  const symbol = STATION_CODE_ALPHABET[index];
  // Индекс всегда в границах: он получен остатком от деления на длину алфавита.
  // Проверка стоит здесь только ради noUncheckedIndexedAccess.
  if (symbol === undefined)
    throw new Error(`Знак ${String(index)} вне алфавита`);
  return symbol;
}

/**
 * Новый код станции. Случайность — от криптографического источника ядра:
 * `Math.random` предсказуем по нескольким выданным значениям, то есть двух кодов
 * со стены пиццерии хватило бы, чтобы вычислить остальные.
 *
 * Байты со значением от `UNBIASED_LIMIT` и выше отбрасываются (отбор с отклонением),
 * поэтому все знаки алфавита равновероятны.
 */
export function generateStationCode(): string {
  const symbols: string[] = [];

  while (symbols.length < STATION_CODE_LENGTH) {
    // Запрашиваем с запасом: часть байтов отбрасывается, и на каждый отброшенный
    // ходить в источник по одному байту дороже, чем взять пачку.
    for (const byte of randomBytes(STATION_CODE_LENGTH)) {
      if (byte >= UNBIASED_LIMIT) continue;
      symbols.push(symbolAt(byte % STATION_CODE_ALPHABET.length));
      if (symbols.length === STATION_CODE_LENGTH) break;
    }
  }

  return symbols.join("");
}
