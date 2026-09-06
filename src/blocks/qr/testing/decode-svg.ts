// Чтение QR обратно с картинки — то, что на самом деле делает камера. Живёт здесь,
// а не внутри одного теста, потому что нужно двоим: модульному тесту рисования и
// сквозному сценарию, который снимает картинку с живой страницы.
//
// Разбирается именно выданная разметка (пробеги и заливки), а кодировщик второй раз
// не зовётся: иначе проверка сверяла бы библиотеку саму с собой.
import jsQR from "jsqr";

/** Один модуль в шести точках растра — примерно то, что видит камера с бумаги. */
const SCALE = 6;

type Rgb = readonly [number, number, number];

interface QrPicture {
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

/** Разбирает картинку в матрицу модулей и цвета, которыми она нарисована. */
export function parseQrSvg(svg: string): QrPicture {
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
    if (row === undefined) {
      throw new Error(`пробег вышел за картинку: y=${String(y)}`);
    }
    for (let step = 0; step < length; step += 1) row[x + step] = true;
  }

  return { grid, dark: rgb(modules[1]), light: rgb(background[1]) };
}

/** Растр в RGBA — то, что увидела бы камера: один модуль в `SCALE` точек. */
function rasterize(picture: QrPicture): {
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

/**
 * Читает ссылку с картинки. `damage` — возможность испортить код перед чтением
 * (затёртое пятно на наклейке).
 *
 * Инверсия не подбирается намеренно: перевёрнутый код (светлые модули на тёмном поле)
 * читает не всякая камера, и молчаливое «а вдруг наоборот» скрыло бы ровно ту ошибку,
 * из-за которой наклейка не работает.
 */
export function decodeQrSvg(
  svg: string,
  damage?: (grid: boolean[][]) => void,
): string {
  const picture = parseQrSvg(svg);
  damage?.(picture.grid);
  const { data, side } = rasterize(picture);

  const found = jsQR(data, side, side, { inversionAttempts: "dontInvert" });
  if (found === null) throw new Error("код с картинки не прочитался");
  return found.data;
}
