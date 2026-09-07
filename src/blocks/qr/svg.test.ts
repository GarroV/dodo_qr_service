import { describe, expect, it } from "vitest";

import { PUBLIC_BASE_URL_VAR } from "./sticker-origin";
import { QR_QUIET_ZONE, stationQrSvg } from "./svg";
import { decodeQrSvg, parseQrSvg } from "./testing/decode-svg";

const ORIGIN = "http://localhost:3160";
const CODE = "k7m2xqvpht";

describe("QR станции в SVG", () => {
  it("читается обратно как публичная ссылка станции", () => {
    expect(decodeQrSvg(stationQrSvg(CODE, ORIGIN))).toBe(`${ORIGIN}/s/${CODE}`);
  });

  it("оставляет вокруг кода тихую зону ровно в 4 модуля", () => {
    // Четвёрка здесь записана числом, а не взята из самого модуля: тест, который
    // берёт ожидание у проверяемого кода, зелен при любом его значении — проверено
    // отрицательным прогоном, где зона была снята и тест этого не заметил.
    const required = 4;
    const { grid } = parseQrSvg(stationQrSvg(CODE, ORIGIN));
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

    expect(decodeQrSvg(svg, spot)).toBe(`${ORIGIN}/s/${CODE}`);
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

describe("QR станции: негодные значения на входе", () => {
  // Значения, которые не должны доходить ни до картинки, ни до наклейки: одни —
  // потому что по ним камера никуда не пойдёт (`javascript:`, `data:`, чужая схема),
  // другие — потому что это попытка внести в вывод что-то своё.
  const HOSTILE_ORIGINS = [
    '"><script>alert(1)</script><svg x="',
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "foo://bar",
    "https://a.example&b=1",
    "http://логин:пароль@example.com",
  ];

  it("отказывает на негодном источнике ссылки, а не печатает наклейку в никуда", () => {
    for (const origin of HOSTILE_ORIGINS) {
      expect(() => stationQrSvg(CODE, origin)).toThrow(
        new RegExp(PUBLIC_BASE_URL_VAR),
      );
    }
  });

  it("в тексте отказа нет ни скобок, ни кавычек, ни амперсанда из значения", () => {
    // Отказ уезжает в журнал площадки и в оверлей разработки: значение целиком,
    // как его прислали, там не нужно — нужна причина и имя переменной.
    for (const origin of HOSTILE_ORIGINS) {
      let message = "";
      try {
        stationQrSvg(CODE, origin);
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).not.toBe("");
      expect(message).not.toMatch(/[<>"&]/);
    }
  });

  it("в разметке картинки нет ничего, кроме чисел и известных литералов", () => {
    // Полная форма вывода, а не поиск «нет ли тут <script>»: любое значение,
    // просочившееся в сборку разметки, ломает это совпадение целиком.
    const shape =
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true"><path fill="#[\da-f]{6}" d="[MHhvz\d \-]*"\/><path fill="#[\da-f]{6}" d="[MHhvz\d \-]*"\/><\/svg>$/;

    for (const code of [CODE, 'a"><script>alert(1)</script>', "a&b", "a<b>c"]) {
      expect(stationQrSvg(code, ORIGIN)).toMatch(shape);
    }
  });

  it("опасный код станции уезжает в ссылку экранированным, а не разметкой", () => {
    const code = 'a"><script>alert(1)</script>&x';

    expect(decodeQrSvg(stationQrSvg(code, ORIGIN))).toBe(
      `${ORIGIN}/s/${encodeURIComponent(code)}`,
    );
  });
});
