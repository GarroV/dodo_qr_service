import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { QR_QUIET_ZONE, stationQrSvg } from "./svg";

const ORIGIN = "http://localhost:3160";
const CODE = "k7m2xqvpht";

/** Один модуль в шести точках растра — примерно то, что видит камера с бумаги. */
const SCALE = 6;

type Rgb = readonly [number, number, number];

interface Picture {
  /** Матрица модулей вместе с тихой зоной. */
  readonly grid: boolean[][];
  /** Цвет модуля и цвет поля — те самые, что записаны в картинке. */
  readonly dark: Rgb;
  readonly light: Rgb;
}

function rgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Сторона картинки в модулях: её объявляет сам SVG в `viewBox`. */
function viewBoxSize(svg: string): number {
  const match = /viewBox="0 0 (\d+) \1"/.exec(svg);
  if (match?.[1] === undefined) {
    throw new Error(`в SVG нет квадратного viewBox: ${svg.slice(0, 120)}`);
  }
  return Number(match[1]);
}

/**
 * Разбирает картинку обратно — по тем самым горизонтальным пробегам и заливкам,
 * которыми её рисует `stationQrSvg`. Тест читает выданный SVG, а не зовёт кодировщик
 * второй раз: иначе он проверял бы сам себя.
 *
 * Цвета берутся из разметки, а не подразумеваются: перевёрнутая заливка (светлые
 * модули на тёмном поле) с бумаги не читается, и тест обязан это увидеть.
 */
function parseSvg(svg: string): Picture {
  const paths = [...svg.matchAll(/<path fill="(#[\da-f]{6})" d="([^"]*)"/gi)];
  const background = paths[0];
  const modules = paths[1];
  if (background?.[1] === undefined || modules?.[1] === undefined) {
    throw new Error("в SVG нет пары «поле + модули»");
  }

  const size = viewBoxSize(svg);
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  for (const run of (modules[2] ?? "").matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    const x = Number(run[1]);
    const y = Number(run[2]);
    const length = Number(run[3]);
    const row = grid[y];
    if (row === undefined)
      throw new Error(`пробег вышел за картинку: y=${String(y)}`);
    for (let step = 0; step < length; step += 1) row[x + step] = true;
  }

  return { grid, dark: rgb(modules[1]), light: rgb(background[1]) };
}

/** Растр в RGBA — то, что увидела бы камера: один модуль в `SCALE` точек. */
function rasterize(picture: Picture): {
  data: Uint8ClampedArray;
  side: number;
} {
  const side = picture.grid.length * SCALE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);

  for (const [y, row] of picture.grid.entries()) {
    for (const [x, dark] of row.entries()) {
      const [red, green, blue] = dark ? picture.dark : picture.light;
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          const offset = ((y * SCALE + dy) * side + (x * SCALE + dx)) * 4;
          data[offset] = red;
          data[offset + 1] = green;
          data[offset + 2] = blue;
        }
      }
    }
  }

  return { data, side };
}

function decode(svg: string, damage?: (grid: boolean[][]) => void): string {
  const picture = parseSvg(svg);
  damage?.(picture.grid);
  const { data, side } = rasterize(picture);
  // Инверсию не подбираем: перевёрнутый код читает не всякая камера, и молчаливое
  // «а вдруг наоборот» скрыло бы ровно ту ошибку, из-за которой наклейка не работает.
  const found = jsQR(data, side, side, { inversionAttempts: "dontInvert" });
  if (found === null) throw new Error("код с картинки не прочитался");
  return found.data;
}

describe("QR станции в SVG", () => {
  it("читается обратно как публичная ссылка станции", () => {
    expect(decode(stationQrSvg(CODE, ORIGIN))).toBe(`${ORIGIN}/s/${CODE}`);
  });

  it("оставляет вокруг кода тихую зону ровно в 4 модуля", () => {
    // Четвёрка здесь записана числом, а не взята из самого модуля: тест, который
    // берёт ожидание у проверяемого кода, зелен при любом его значении — проверено
    // отрицательным прогоном, где зона была снята и тест этого не заметил.
    const required = 4;
    const { grid } = parseSvg(stationQrSvg(CODE, ORIGIN));
    const size = grid.length;
    const isDark = (x: number, y: number): boolean => grid[y]?.[x] === true;

    for (let index = 0; index < size; index += 1) {
      for (let edge = 0; edge < required; edge += 1) {
        expect(isDark(index, edge)).toBe(false);
        expect(isDark(index, size - 1 - edge)).toBe(false);
        expect(isDark(edge, index)).toBe(false);
        expect(isDark(size - 1 - edge, index)).toBe(false);
      }
    }

    // Зона не шире четырёх: угол опорного квадрата стоит вплотную к ней.
    expect(isDark(required, required)).toBe(true);
    expect(QR_QUIET_ZONE).toBe(required);
  });

  it("читается с затёртым пятном: наклейка на кухне живёт годами", () => {
    // Пятно 9×9 модулей (7,4% кода) в середине — в стороне от трёх опорных
    // квадратов, потеря которых не лечится никаким уровнем коррекции.
    // Размер выбран прогоном: при `Q` код читается, при `M` и `L` — уже нет,
    // то есть тест держит именно выбранный уровень, а не существование библиотеки.
    const spotSide = 9;
    const svg = stationQrSvg(CODE, ORIGIN);
    const spot = (grid: boolean[][]): void => {
      const from = Math.floor((grid.length - spotSide) / 2);
      for (let y = from; y < from + spotSide; y += 1) {
        for (let x = from; x < from + spotSide; x += 1) {
          const row = grid[y];
          if (row !== undefined) row[x] = false;
        }
      }
    };

    expect(decode(svg, spot)).toBe(`${ORIGIN}/s/${CODE}`);
  });

  it("не ходит наружу: в картинке нет ни ссылок, ни внешних вложений", () => {
    const svg = stationQrSvg(CODE, ORIGIN);
    // Пространство имён SVG — опознавательная строка, а не адрес: браузер по нему
    // никуда не ходит. Всё остальное с `http` в картинке было бы запросом наружу.
    const withoutNamespace = svg.replace(
      'xmlns="http://www.w3.org/2000/svg"',
      "",
    );

    expect(withoutNamespace).not.toMatch(/https?:/i);
    expect(svg).not.toMatch(/<image|xlink|<script|<foreignObject/i);
    // Полезная нагрузка живёт только в геометрии: подставить в разметку нечего.
    expect(svg).not.toContain(CODE);
  });

  it("для одного кода даёт одну и ту же картинку, для разных — разные", () => {
    expect(stationQrSvg(CODE, ORIGIN)).toBe(stationQrSvg(CODE, ORIGIN));
    expect(stationQrSvg(CODE, ORIGIN)).not.toBe(
      stationQrSvg("b3n8wr5tqd", ORIGIN),
    );
  });

  it("отказывает на пустом коде, а не рисует ссылку в никуда", () => {
    expect(() => stationQrSvg("", ORIGIN)).toThrow(/код/i);
  });
});
