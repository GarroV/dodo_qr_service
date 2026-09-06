// Откуда берётся адрес, который зашивается в напечатанный QR-код.
//
// Наклейка печатается один раз и живёт годами (D006), а адреса у площадок разные:
// на машине разработчика `http://localhost:3100`, на домашнем сервере — туннель со
// своим именем и единственным свободным портом. Зашитый в код адрес означал бы, что
// после переезда все наклейки во всех пиццериях ведут в никуда и печатаются заново.
// Поэтому адрес задаётся окружением площадки, а не константой.
//
// ВНИМАНИЕ на раскатке: значения переменных запекаются в сборку (D033). Смена
// `PUBLIC_BASE_URL` без пересборки не меняет коды: продукт продолжает печатать
// прежний адрес, и выглядит это как «поменяли адрес, а коды старые».

import { PUBLIC_BASE_URL_VAR, stickerOrigin } from "../sticker-origin";

export { PUBLIC_BASE_URL_VAR };

/** Первое звено цепочки прокси: `a, b, c` — это путь запроса, ближайший к посетителю первый. */
function firstHop(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first === undefined || first === "" ? undefined : first;
}

/**
 * Адрес продукта из окружения площадки. `null` — переменная не задана.
 *
 * Заданная мусором переменная — отказ, а не тихий возврат к умолчанию: молчаливая
 * подмена адреса и есть та ошибка, которая обнаруживается уже наклеенной.
 */
export function configuredOrigin(
  env: Record<string, string | undefined>,
): string | null {
  const raw = env[PUBLIC_BASE_URL_VAR]?.trim();
  if (raw === undefined || raw === "") return null;

  // Правило пригодности одно на всех, кто строит ссылку (`../sticker-origin`):
  // `muspelheim:10000` и `javascript:alert(1)` — формально адреса, но камера
  // телефона по ним никуда не пойдёт. В ссылку идёт только источник: путь
  // и параметры из переменной в наклейке лишние.
  return stickerOrigin(raw);
}

/**
 * Адрес, по которому открыт сам продукт. Запасной путь, когда площадка переменную
 * не задала: свежий клон и прогон сценариев работают без `.env`, и падать там,
 * где достаточно взять адрес запроса, незачем.
 */
export function originFromHeaders(headers: Headers): string {
  const host =
    firstHop(headers.get("x-forwarded-host")) ??
    firstHop(headers.get("host")) ??
    undefined;
  if (host === undefined) {
    throw new Error(
      `ссылка станции: в запросе нет узла (host), а ${PUBLIC_BASE_URL_VAR} не задан`,
    );
  }

  const proto = firstHop(headers.get("x-forwarded-proto")) ?? "http";

  // Узел и схема приходят из заголовков, то есть снаружи: тем же правилом
  // пригодности, что и значение переменной, — своего у них быть не должно.
  return stickerOrigin(`${proto}://${host}`);
}

/** Источник ссылки для кода станции: окружение площадки, иначе адрес запроса. */
export function scanOrigin(
  headers: Headers,
  env: Record<string, string | undefined>,
): string {
  return configuredOrigin(env) ?? originFromHeaders(headers);
}
