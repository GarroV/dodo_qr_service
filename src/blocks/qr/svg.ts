// Рисование QR станции. Кодирует библиотека `qrcode` (техплан), рисует этот модуль:
// библиотека умеет отдавать SVG сама, но только обещанием (`toString` асинхронный),
// а разметке экрана и печатному листу картинка нужна прямо в рендере.
//
// Внешних запросов нет и быть не может: сервисы вида api.qrserver.com отдают чужой
// картинке нашу публичную ссылку и отваливаются вместе с интернетом в пиццерии.
import QRCode from "qrcode";

import { stationScanUrl } from "./scan-url";

/**
 * Тихая зона в модулях. Четыре — требование стандарта: без белого поля вокруг
 * камера не находит границы кода и на бумаге он не читается вовсе.
 */
export const QR_QUIET_ZONE = 4;

/**
 * Уровень коррекции ошибок. `Q` (восстановление до 25%) вместо привычного `M`:
 * наклейка печатается один раз и живёт годами в рабочей зоне кухни — её затирают,
 * пачкают и цепляют. Плата — код на четыре модуля крупнее, на 42 мм это незаметно.
 */
const ERROR_CORRECTION = "Q" as const;

const DARK = "#000000";
const LIGHT = "#ffffff";

/** Горизонтальные пробеги тёмных модулей одной строки — по одному контуру на пробег. */
function rowRuns(
  modules: { size: number; get: (row: number, col: number) => number },
  y: number,
): string {
  const parts: string[] = [];
  let runStart: number | null = null;

  for (let x = 0; x <= modules.size; x += 1) {
    const dark = x < modules.size && modules.get(y, x) === 1;
    if (dark && runStart === null) runStart = x;
    if (!dark && runStart !== null) {
      const from = runStart + QR_QUIET_ZONE;
      const length = x - runStart;
      parts.push(
        `M${String(from)} ${String(y + QR_QUIET_ZONE)}h${String(length)}v1h-${String(length)}z`,
      );
      runStart = null;
    }
  }

  return parts.join("");
}

/**
 * QR-код станции в SVG: одна строка разметки, готовая к вставке в страницу.
 *
 * Второй аргумент — источник ссылки (`https://host`); в контракте блока его не было,
 * но без него в наклейку попал бы относительный путь, который камера не откроет.
 *
 * В разметку не попадает ни сам код, ни ссылка: только геометрия, то есть
 * подставить в неё через код станции нечего.
 */
export function stationQrSvg(code: string, origin: string): string {
  const url = stationScanUrl(origin, code);
  const { modules } = QRCode.create(url, {
    errorCorrectionLevel: ERROR_CORRECTION,
  });

  const side = modules.size + QR_QUIET_ZONE * 2;
  const path = Array.from({ length: modules.size }, (_, y) =>
    rowRuns(modules, y),
  ).join("");
  const box = String(side);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" ` +
    `width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">` +
    `<path fill="${LIGHT}" d="M0 0h${box}v${box}H0z"/>` +
    `<path fill="${DARK}" d="${path}"/>` +
    `</svg>`
  );
}
