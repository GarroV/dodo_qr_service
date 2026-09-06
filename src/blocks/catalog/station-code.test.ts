// Код станции — единственная защита публичной ссылки заполнения (D021): опознания
// нет, значит угаданный код открывает чужую точку записи в базу. Поэтому здесь
// проверяется не «строка нужной длины», а три свойства: неугадываемость (источник
// случайности), равномерность (перебор не сужается) и читаемость вслух и с наклейки.
import { describe, expect, test, vi } from "vitest";

import {
  STATION_CODE_ALPHABET,
  STATION_CODE_LENGTH,
  generateStationCode,
} from "./station-code";

/** Знаки, которые человек путает, переписывая код с наклейки или диктуя по телефону. */
const LOOKALIKES = ["0", "O", "o", "1", "l", "I", "i"];

function generateMany(count: number): string[] {
  return Array.from({ length: count }, () => generateStationCode());
}

describe("код станции", () => {
  test("длина ровно 10 знаков", () => {
    for (const code of generateMany(50)) {
      expect(code).toHaveLength(STATION_CODE_LENGTH);
    }
  });

  test("состоит только из знаков своего алфавита", () => {
    const allowed = new Set(STATION_CODE_ALPHABET);

    for (const code of generateMany(200)) {
      for (const symbol of code) {
        expect(
          allowed.has(symbol),
          `знак «${symbol}» в коде «${code}» не из алфавита`,
        ).toBe(true);
      }
    }
  });

  test("в алфавите нет похожих знаков: ни 0/O, ни 1/l", () => {
    for (const lookalike of LOOKALIKES) {
      expect(
        STATION_CODE_ALPHABET.includes(lookalike),
        `в алфавите остался похожий знак «${lookalike}»`,
      ).toBe(false);
    }
  });

  test("алфавита хватает на неугадываемый код", () => {
    // 31^10 ≈ 8·10^14: перебор через публичный маршрут неосуществим даже без ограничения
    // частоты. Меньший алфавит или более короткий код обесценили бы единственную защиту.
    const combinations = STATION_CODE_ALPHABET.length ** STATION_CODE_LENGTH;

    expect(combinations).toBeGreaterThan(1e14);
  });

  test("случайность берётся у криптографического источника, а не у Math.random", () => {
    // Math.random предсказуем по нескольким выданным значениям: увидев два кода со
    // стены пиццерии, можно вычислить остальные. Проверяется фактом вызова, а не верой.
    const insecure = vi.spyOn(Math, "random");

    generateMany(20);

    expect(insecure).not.toHaveBeenCalled();
    insecure.mockRestore();
  });

  test("коды не повторяются", () => {
    const codes = generateMany(5000);

    expect(new Set(codes).size).toBe(codes.length);
  });

  test("ни один знак алфавита не встречается заметно чаще других", () => {
    // Наивное `случайный_байт % 31` даёт первым восьми знакам алфавита перевес в 12,5%:
    // перебор сужается, а дефект не виден ни глазом, ни проверкой «состоит из алфавита».
    const sampleSize = 31_000;
    // Array.from, а не спред: алфавит заведомо ASCII, но правило линта справедливо
    // запрещает разбирать строку спредом — на не-ASCII это молчаливо ломается.
    const counts = new Map<string, number>(
      Array.from(STATION_CODE_ALPHABET, (symbol) => [symbol, 0]),
    );

    for (const code of generateMany(sampleSize)) {
      for (const symbol of code) {
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      }
    }

    const expected =
      (sampleSize * STATION_CODE_LENGTH) / STATION_CODE_ALPHABET.length;
    // ±5% — это пять стандартных отклонений от честной равномерности (случайная
    // осечка исключена) и вдвое меньше перевеса от `% 31` (перекос будет пойман).
    const tolerance = 0.05;

    for (const [symbol, count] of counts) {
      expect(
        Math.abs(count - expected) / expected,
        `знак «${symbol}» выпал ${String(count)} раз при ожидаемых ${String(expected)}`,
      ).toBeLessThan(tolerance);
    }
  });
});
