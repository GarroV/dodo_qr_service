<!-- Описание блока. Контракт здесь — источник истины для блок-агента. -->

# Block: catalog

## Назначение

Справочник: страны, пиццерии, станции и привязка чек-листа к станции. Три колонки, читающиеся как путь.

## Контракт

```ts
listCountries(); createCountry({ id, name, defaultLanguage })
listStores(countryId); createStore({ countryId, name, timezone }); updateStore(...)
listStations(storeId); createStation({ storeId, name })
reissueStationCode(stationId): Promise<{ code: string; issuedAt: Date }>
assignChecklist(stationId, checklistId)
```
Код станции — 10 символов из алфавита без похожих знаков, криптографически случайный.

## Зависимости

`data`, `auth`

## Definition of Done блока

1. Страна → пиццерия → станция создаются и правятся из интерфейса.
2. Удаление пиццерии со станциями требует подтверждения и не оставляет висячих станций.
3. Станция без назначенного чек-листа помечена явно.
4. Перевыпуск кода: старый код перестаёт открывать чек-лист сразу, новый работает.
5. Экран совпадает с эталоном `docs/forge/design/screens/catalog.html`.

## Статус

todo
