// Состояние экрана справочника живёт в адресе, а не в памяти браузера: выбранная
// страна и пиццерия переживают перезагрузку, ссылкой можно поделиться, и весь экран
// остаётся серверным — формы работают даже с выключенным JavaScript.
//
// Всё, что приходит из адреса, — ввод от кого угодно, поэтому разбирается строго
// (принцип безопасности: проверка на границе), а не подставляется в запрос как есть.
import { isCatalogErrorCode, type CatalogErrorCode } from "../errors";

export const CATALOG_PATH = "/admin/catalog";

const FOCUS_KINDS = ["country", "store", "station"] as const;
/** Что показывает карточка под деревом: страна, пиццерия или станция. */
export type CatalogFocus = (typeof FOCUS_KINDS)[number];

const FORM_KINDS = ["country", "store", "station"] as const;
/** Какая форма создания раскрыта. Раскрытие — адрес, а не состояние компонента. */
export type CatalogFormKind = (typeof FORM_KINDS)[number];

const CONFIRM_KINDS = ["store", "station"] as const;
/** Что подтверждают к удалению. Удаление без подтверждения невозможно по контракту. */
export type CatalogConfirmKind = (typeof CONFIRM_KINDS)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CatalogView {
  countryId?: string;
  storeId?: string;
  stationId?: string;
  focus?: CatalogFocus;
  create?: CatalogFormKind;
  confirm?: CatalogConfirmKind;
  error?: CatalogErrorCode;
}

/** Значения параметров адреса. Next отдаёт их именно так: строка, список или ничего. */
export type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  // Повторённый параметр (`?country=a&country=b`) — попытка подсунуть неожиданное:
  // берём первое значение, а не склеиваем.
  return Array.isArray(value) ? value[0] : value;
}

function uuidOrNothing(
  value: string | string[] | undefined,
): string | undefined {
  const raw = single(value);
  return raw !== undefined && UUID_PATTERN.test(raw) ? raw : undefined;
}

function oneOf<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const raw = single(value);
  return allowed.find((item) => item === raw);
}

/** Разбирает адрес экрана. Всё непонятное отбрасывается молча: это не ошибка, а мусор. */
export function parseCatalogView(params: SearchParams): CatalogView {
  const error = single(params["error"]);

  return {
    countryId: uuidOrNothing(params["country"]),
    storeId: uuidOrNothing(params["store"]),
    stationId: uuidOrNothing(params["station"]),
    focus: oneOf(params["focus"], FOCUS_KINDS),
    create: oneOf(params["create"], FORM_KINDS),
    confirm: oneOf(params["confirm"], CONFIRM_KINDS),
    error: isCatalogErrorCode(error) ? error : undefined,
  };
}

/** Адрес экрана с заданным состоянием. Пустые значения в адрес не попадают. */
export function catalogHref(view: CatalogView): string {
  const query = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["country", view.countryId],
    ["store", view.storeId],
    ["station", view.stationId],
    ["focus", view.focus],
    ["create", view.create],
    ["confirm", view.confirm],
    ["error", view.error],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") query.set(key, value);
  }

  const search = query.toString();
  return search === "" ? CATALOG_PATH : `${CATALOG_PATH}?${search}`;
}
