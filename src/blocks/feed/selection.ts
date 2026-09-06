// Фильтры ленты работают вместе: страна сужает список пиццерий, пиццерия — список
// станций. Выбор, противоречащий сужению (пиццерия чужой страны), отбрасывается:
// иначе фильтры складываются в заведомо пустую ленту, и экран молча показывает
// «заполнений нет» там, где их просто не может быть.
import type { FeedSelection, FeedStoreOption, FilterOption } from "./model";
import type { FeedCatalog } from "./options";
import type { FeedView } from "./view";

function byName(a: FilterOption, b: FilterOption): number {
  return a.name.localeCompare(b.name, "ru");
}

function exists(options: readonly FilterOption[], id: string | undefined) {
  return id !== undefined && options.some((option) => option.id === id);
}

/**
 * Раскладывает фильтр в то, что показывает экран: выбранные значения (только
 * существующие и согласованные между собой) и списки, уже суженные выбором.
 */
export function resolveSelection(
  view: FeedView,
  catalog: FeedCatalog,
): FeedSelection {
  const countries = [...catalog.countries].sort(byName);
  const countryId = exists(countries, view.countryId)
    ? (view.countryId ?? null)
    : null;

  const stores = [...catalog.stores]
    .filter((store) => countryId === null || store.countryId === countryId)
    .sort(byName);
  const storeId = exists(stores, view.storeId) ? (view.storeId ?? null) : null;

  const storeIds = new Set(stores.map((store) => store.id));
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const stations = catalog.stations
    .filter((station) =>
      storeId === null
        ? storeIds.has(station.storeId)
        : station.storeId === storeId,
    )
    // Пока пиццерия не выбрана, «Кухня» есть в каждой, и список превращается в
    // несколько одинаковых строк — управляющий выбирает вслепую. Поэтому без
    // выбранной пиццерии станция названа путём (та же причина, что в D032),
    // а с выбранной путь не нужен: список и так её.
    .map((station) =>
      storeId === null
        ? {
            ...station,
            name: `${storeNames.get(station.storeId) ?? ""} · ${station.name}`,
          }
        : station,
    )
    .sort(byName);
  const stationId = exists(stations, view.stationId)
    ? (view.stationId ?? null)
    : null;

  return {
    countryId,
    storeId,
    stationId,
    period: view.period,
    countries,
    stores,
    stations,
  };
}

/**
 * Пояс, в котором считается «сегодня» и подписывается день.
 *
 * Пиццерия выбрана — её пояс, вопросов нет. Без пиццерии пояс берётся, только если он
 * общий у всех пиццерий в фильтре; иначе одного правильного ответа не существует, и
 * экран считает период по поясу площадки, честно подписывая, по какому именно.
 */
export function screenTimeZone(selection: FeedSelection): string {
  const platformZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Станция однозначно задаёт пиццерию: выбрав «Кухню», управляющий выбрал и точку,
  // даже если список пиццерий остался на «Все».
  const storeId =
    selection.storeId ??
    selection.stations.find((station) => station.id === selection.stationId)
      ?.storeId ??
    null;

  if (storeId !== null) {
    const store = selection.stores.find(
      (candidate) => candidate.id === storeId,
    );
    if (store !== undefined) return store.timezone;
  }

  const zones = new Set(selection.stores.map((store) => store.timezone));
  const [only] = zones;
  return zones.size === 1 && only !== undefined ? only : platformZone;
}

/**
 * Пояс экрана выбран не однозначно: пиццерия не выбрана, а пояса у пиццерий фильтра
 * разные — «сегодня» посчитано по поясу площадки. Только в этом случае экран и
 * подписывает пояс: в обычной работе (одна страна, один пояс) подпись была бы шумом,
 * которого нет и на эталоне.
 */
export function isTimeZoneAmbiguous(selection: FeedSelection): boolean {
  const storeId =
    selection.storeId ??
    selection.stations.find((station) => station.id === selection.stationId)
      ?.storeId ??
    null;
  if (storeId !== null) return false;

  return new Set(selection.stores.map((store) => store.timezone)).size > 1;
}

/** Пояс пиццерии, где заполняли: время строки ленты показывается в нём. */
export function storeTimeZone(
  stores: readonly FeedStoreOption[],
  storeId: string,
  fallback: string,
): string {
  return stores.find((store) => store.id === storeId)?.timezone ?? fallback;
}
