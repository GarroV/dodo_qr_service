<!-- Описание блока. Контракт здесь — источник истины для блок-агента. -->

# Block: data

## Назначение

Схема данных, миграции и единственный слой доступа к базе. Все остальные блоки ходят в данные только через него — это и архитектурное решение, и правило, проверяемое границами модулей.

## API-контракт

```ts
// схема
countries, stores, stations, checklists, checklist_versions, blocks, submissions

// типы
type Item = { id: string; title: Record<string,string>; type: 'bool'|'number'|'text';
              critical: boolean; min?: number; max?: number; hint?: Record<string,string> }
type Section = { id: string; title: Record<string,string>;
                 source: 'own' | { blockId: string }; items: Item[] }
type Answer = { itemId: string; value: boolean|number|string; comment?: string; at: number }

// функции
getPublishedVersionForStation(stationCode: string, at: Date): Promise<VersionWithChecklist | null>
getDraft(checklistId: string): Promise<ChecklistVersion | null>
publishVersion(checklistId: string): Promise<ChecklistVersion>   // вставка строки, не update
saveSubmission(input: { versionId: string; answers: Answer[]; startedAt: number }): Promise<string>
listSubmissions(filter: { countryId?; storeId?; stationId?; from?; to? }): Promise<SubmissionRow[]>
getSubmission(id: string): Promise<SubmissionDetail | null>
```
Частичный уникальный индекс: одна опубликованная версия на чек-лист. Все отметки времени сервера — `now()` базы, не клиентские.

## Зависимости

`core`

## Definition of Done блока

1. Миграции применяются с нуля и откатываются.
2. `publishVersion` создаёт новую строку, прежняя версия побайтово не меняется — тест сравнивает содержимое до и после.
3. `getPublishedVersionForStation` возвращает версию по окну времени: утренний чек-лист в 09:00, вечерний в 21:00, `null` в 15:00, если ни одно окно не подходит.
4. Заполнение ссылается на конкретную версию; после публикации следующей версии старое заполнение читается без изменений.
5. Неизвестный код станции даёт `null`, а не исключение и не чужие данные.
6. Покрытие слоя доступа тестами с реальной базой в контейнере.

## Статус

todo
