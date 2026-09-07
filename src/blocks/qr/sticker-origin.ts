// Пригодность значений, из которых собирается ссылка на наклейке станции.
//
// Адрес приходит снаружи: из переменной окружения площадки (D040) или из заголовков
// запроса, которые задаёт не продукт. `new URL` разбирает заметно больше, чем годится
// наклейке: `javascript:alert(1)` для него адрес, но источник у такого адреса — строка
// «null», и в напечатанный код уезжает `null/s/<код>`. Наклейка печатается один раз
// и живёт годами (D006), поэтому пригодность проверяется до рисования и одним правилом
// на всех, кто строит ссылку: экран печати, экран планшета, сквозные сценарии.

/** Имя переменной окружения с публичным адресом продукта. */
export const PUBLIC_BASE_URL_VAR = "PUBLIC_BASE_URL";

/**
 * Форма источника, годного для наклейки: схема, узел, порт — и ничего больше.
 * Узлом считается имя (в том числе punycode после разбора) или адрес IPv6 в скобках.
 */
const USABLE_ORIGIN =
  /^https?:\/\/(\[[\d.:a-f]+]|[\da-z](?:[\d.a-z-]*[\da-z])?)(?::\d{1,5})?$/;

/** Всё, что не буква, не цифра и не знак адреса, в пересказе заменяется точкой. */
const UNSAFE_IN_EXCERPT = /[^\p{L}\p{N}.:/@_[\]-]/gu;
const EXCERPT_LIMIT = 48;

/**
 * Значение так, как его можно повторить в отказе.
 *
 * Отказ уезжает в журнал площадки и в оверлей разработки. Показать, что именно
 * не разобралось, полезно — администратор ищет свою опечатку; пересказывать туда
 * присланное дословно не нужно никому.
 */
function excerpt(value: string): string {
  const filtered = value.replaceAll(UNSAFE_IN_EXCERPT, "·");
  return filtered.length <= EXCERPT_LIMIT
    ? filtered
    : `${filtered.slice(0, EXCERPT_LIMIT)}…`;
}

function refuse(reason: string, value: string): never {
  throw new Error(
    `${PUBLIC_BASE_URL_VAR}: источник ссылки не годится — ${reason}. ` +
      `Ожидается адрес вида https://узел:порт (схема, имя узла, порт), получено ${excerpt(value)}`,
  );
}

/**
 * Источник ссылки, годный для наклейки, — или отказ.
 *
 * Отказ, а не догадка и не тихое умолчание: код, напечатанный «на вид рабочим»,
 * обнаруживается уже наклеенным на всю сеть.
 */
export function stickerOrigin(raw: string): string {
  const value = raw.trim();

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    refuse("значение не разбирается как адрес", value);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    refuse("схема не http и не https", value);
  }
  // `http://логин:пароль@узел` молча превращается в `http://узел`: напечатанный
  // адрес разошёлся бы с заданным, и заметить это было бы негде.
  if (url.username !== "" || url.password !== "") {
    refuse("в значении учётные данные", value);
  }
  if (!USABLE_ORIGIN.test(url.origin)) {
    refuse("узел не годится для наклейки", value);
  }

  return url.origin;
}

/** Имя переменной окружения с базовым путём, на котором площадка публикует продукт. */
const BASE_PATH_VAR = "BASE_PATH";

/** Годный базовый путь: сегменты из букв, цифр, дефиса и подчёркивания. */
const USABLE_BASE_PATH = /^(?:\/[\w-]+)+$/;

/**
 * Базовый путь площадки, приведённый к одному виду: `/qr` или пустая строка.
 *
 * Нужен там, где у площадки нет своего адреса целиком: у Tailscale всего три порта
 * под публикацию, и корень порта может занимать соседний сервис (D045). Путь уезжает
 * внутрь напечатанного кода наравне с источником, поэтому проверяется так же строго:
 * `//evil.example` — формально путь, а по факту чужой узел.
 */
export function publicBasePath(
  env: Record<string, string | undefined>,
): string {
  const raw = env[BASE_PATH_VAR]?.trim();
  if (raw === undefined || raw === "") return "";

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const value = withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;

  if (!USABLE_BASE_PATH.test(value)) {
    throw new Error(
      `${BASE_PATH_VAR}: базовый путь не годится — ожидается вид «/qr», получено «${excerpt(raw)}». ` +
        "Путь печатается внутри QR-кода станции, поэтому чужой узел, запрос и якорь в нём недопустимы",
    );
  }

  return value;
}
