<!-- managed by forge: do not change the row format below — forge-build and forge-status parse this file -->
# Tasks

<!-- id: Tnnn (T001, T002, ...). status: todo | in_progress | done | failed | blocked:Qnnn (Qnnn — the id of an open question in questions.md). "depends on" — ids separated by commas, or "—". block: the name of a product block from plan.md, or chores for housekeeping tasks that belong to no block (topping up research, obtaining access, applying an owner's answer) — those are never handed to block agents. issue: the task's number in the project tracker (#N), or "—" if it has none. The issue column is what makes reconciling the graph against the tracker mechanical: without it the link lives in commit text, and the graph falls behind the tracker silently — on a live project that is how the build stood still for a month and a half.

stage: the number of the wave in which the task is done (1, 2, 3…), or "—" if the product is built in one pass. A stage is something that must work end to end — "the month is calculated in the browser" — not "block api is finished". Why it has to be machine-readable: without it a graph passes the integrity check and is still unreachable — the goal of the first wave depends on a task from the fourth, and only a person holding the waves in their head can see it. The rule that then gets checked: a task may not depend on a task from a later stage. Use the same number as the stage marks on the Definition of Done items in the block description. -->

| id | block | depends on | status | task | issue | stage |
|---|---|---|---|---|---|---|
<!-- | T001 | api | — | todo | Example: design the database schema | #12 | 1 | -->
| T001 | core | — | done | Поднять каркас: Next.js 16.3.4 (App Router), TypeScript 6.0.3, Tailwind 4.3.3; страница отвечает на http://localhost:3100 | — | 1 |
| T002 | core | — | done | Docker Compose с PostgreSQL 17 на порту 5433; `psql "$DATABASE_URL" -c 'select 1'` отвечает; `.env.example` с именами переменных | — | 1 |
| T003 | core | T001 | done | Поставить конфиги шести проверок: prettier, eslint 10 flat с typescript-eslint strictTypeChecked, tsconfig со strict и noUncheckedIndexedAccess, vitest с покрытием, knip, dependency-cruiser; `.npmrc` с min-release-age=7 | — | 1 |
| T004 | core | T003 | done | Написать исполняемый `scripts/check`: запускает весь набор и пишет reports/vitest.junit.xml и reports/playwright.junit.xml | — | 1 |
| T005 | core | T004 | done | Проверить каждую из шести проверок на испорченной копии: неформатированный файл, нарушение линта, ошибка типов, падающий тест, неиспользуемый экспорт, импорт мимо графа — каждая падает и печатает причину | — | 1 |
| T006 | core | T004 | done | Поставить хук .githooks/pre-push, включить core.hooksPath; хук падает, когда инструмента нет, и останавливает пуш при красной проверке | — | 1 |
| T007 | core | T001 | done | Смоук связок из рисков: Tailwind 4 с токеном из `@theme inline` под Turbopack и next-intl с выбором языка по заголовку браузера без cookie | — | 1 |
| T008 | data | T002,T003 | in_progress | Схема Drizzle: countries, stores, stations, checklists, checklist_versions, blocks, submissions; типы Item, Section, Answer через .$type<T>() | — | 1 |
| T009 | data | T008 | in_progress | Миграции применяются с нуля и откатываются; частичный уникальный индекс «одна опубликованная версия на чек-лист» | — | 1 |
| T010 | data | T009 | in_progress | publishVersion: публикация вставляет строку версии и не трогает предыдущую — тест сравнивает содержимое прежней версии до и после | — | 1 |
| T011 | data | T009 | in_progress | getPublishedVersionForStation(stationCode, at): утренний чек-лист в 09:00, вечерний в 21:00, null в 15:00 без подходящего окна, null на неизвестном коде | — | 1 |
| T012 | data | T009 | in_progress | saveSubmission, listSubmissions, getSubmission; серверные отметки времени берутся из базы, а не от клиента | — | 1 |
| T013 | auth | T001 | in_progress | Вход в админку: хэш пароля из ADMIN_PASSWORD_HASH, сравнение постоянного времени, подписанная httpOnly-cookie на 30 дней | — | 1 |
| T014 | auth | T013 | in_progress | requireAdmin() и защита всех маршрутов /admin/*; сквозной тест: без сессии ни один экран админки не отдаёт данные | — | 1 |
| T015 | catalog | T012,T014 | todo | Справочник стран, пиццерий и станций: создание, правка, удаление с подтверждением и без висячих станций | — | 1 |
| T016 | catalog | T015 | todo | Код станции: 10 символов криптографически случайно, без похожих знаков; перевыпуск ломает старый код сразу | — | 1 |
| T017 | catalog | T015 | todo | Привязка чек-листа к станции; станция без назначенного чек-листа помечена явно | — | 1 |
| T018 | catalog | T015 | todo | Экран справочника по эталону docs/forge/design/screens/catalog.html | — | 1 |
| T019 | editor | T012,T014 | todo | Черновик чек-листа: создание, сохранение секций и пунктов, окно времени, привязка к станции | — | 1 |
| T020 | editor | T019 | todo | Клавиатурная работа: Enter создаёт следующий пункт и ставит курсор, Alt+стрелки переставляют | — | 1 |
| T021 | editor | T019 | todo | parsePastedList: вставка 20 строк из буфера даёт 20 пунктов за одно действие, маркеры и нумерация отброшены, пустые строки пропущены | — | 1 |
| T022 | editor | T019 | todo | Типы ответов (да/нет, число с диапазоном, текст) и признак критичности; по умолчанию да/нет | — | 1 |
| T023 | editor | T010,T019 | todo | Публикация версии из черновика: разные действия «сохранить черновик» и «опубликовать» | — | 1 |
| T024 | editor | T019 | todo | Дублирование чек-листа целиком, включая перенос на другую станцию; история заполнений не копируется | — | 1 |
| T025 | editor | T019 | todo | Предпросмотр «как это увидит сотрудник»: тот же экран заполнения с данными черновика | — | 1 |
| T026 | editor | T020,T021,T022 | todo | Экран редактора по эталону docs/forge/design/screens/editor.html | — | 1 |
| T027 | library | T019 | todo | Библиотека блоков: создание, правка, список; блок хранит название и пункты | — | 1 |
| T028 | library | T023,T027 | todo | Вставка блока в черновик ссылкой; при публикации ссылка разворачивается в снимок содержимого | — | 1 |
| T029 | library | T028 | todo | Тест: правка блока приходит во все черновики и не меняет ни одной опубликованной версии | — | 1 |
| T030 | library | T028 | todo | «Где используется»: список чек-листов со ссылками и предупреждение, сколько черновиков и опубликованных версий затронет правка | — | 1 |
| T031 | library | T027 | todo | Экран библиотеки по эталону docs/forge/design/screens/library.html | — | 1 |
| T032 | qr | T016 | todo | Генерация QR станции в SVG без внешних запросов | — | 1 |
| T033 | qr | T032 | todo | Лист A4 для печати: наклейки всех станций пиццерии, при печати не выводятся меню, кнопки и фон | — | 1 |
| T034 | qr | T032 | todo | Полноэкранный QR для планшета станции; после перевыпуска кода показывает новый без ручного обновления | — | 1 |
| T035 | qr | T033 | todo | Проверить распечатанный лист камерой телефона: код читается с бумаги, а не только с экрана | — | 1 |
| T036 | qr | T033 | todo | Экран QR по эталону docs/forge/design/screens/qr-sheet.html | — | 1 |
| T037 | fill | T011,T023 | todo | Маршрут /s/<код станции>: отдаёт опубликованную версию по станции и окну времени и ничего сверх этого | — | 1 |
| T038 | fill | T037 | todo | Язык интерфейса и пунктов по языку устройства с откатом на язык страны и далее на русский | — | 1 |
| T039 | fill | T037 | todo | Экран заполнения: секции, прогресс, кнопка с числом оставшихся пунктов, зоны нажатия от 44 px на ширине 375 px | — | 1 |
| T040 | fill | T039 | todo | Проваленный критичный пункт требует комментарий сразу под собой и не даёт отправить без него | — | 1 |
| T041 | fill | T012,T039 | todo | Отправка заполнения пишется на ту версию, что была отдана клиенту — тест на гонку с публикацией новой версии во время заполнения | — | 1 |
| T042 | fill | T037 | todo | Защита публичной точки записи: ограничение частоты отправок с одного кода, проверка входящих данных схемой, отказ на неизвестный и перевыпущенный код; тест перебора кодов не отдаёт ничего сверх отказа | — | 1 |
| T043 | fill | T039 | todo | Состояния экрана сотрудника: отправлено, ссылка не действует, для станции нет чек-листа, обрыв связи без потери введённого | — | 1 |
| T044 | feed | T012,T014 | todo | Лента заполнений с фильтрами по стране, пиццерии, станции и периоду | — | 1 |
| T045 | feed | T044 | todo | Три показателя за выбранный день считаются по тем же данным, что и лента | — | 1 |
| T046 | feed | T044 | todo | Карточка заполнения: ответ и время по каждому пункту, комментарии к проваленным, пункты снимком той версии, по которой заполняли | — | 1 |
| T047 | feed | T046 | todo | Сквозной тест: правка и публикация новой версии чек-листа не меняют ранее сохранённую карточку | — | 1 |
| T048 | feed | T044,T046 | todo | Экраны ленты и карточки по эталонам feed.html и submission.html | — | 1 |
| T049 | demo | T018,T026,T039,T048 | todo | Идемпотентный сид демонстрационного контура на английском: страна, две пиццерии, станции с кодами, три чек-листа с секциями и переиспользуемым блоком, десяток заполнений с одним проваленным критичным пунктом | — | 1 |
| T050 | demo | T049 | todo | Продукт поднимается на локальной площадке одной командой, адрес открывается в браузере | — | 1 |
| T051 | demo | T050 | todo | Сквозной смоук MVP на поднятом продукте: завёл страну и пиццерию, создал чек-лист, напечатал QR, заполнил с телефона, увидел заполнение в ленте | — | 1 |
| T052 | demo | T039,T048 | todo | Проверка доступности прогоном: axe внутри сценариев Playwright на экране заполнения и экранах админки | — | 1 |
| T053 | chores | — | blocked:Q002 | Создать репозиторий на GitHub и зеркалировать задачи в Issues после ответа владельца про имя и владельца репозитория | — | 1 |
| T054 | chores | — | todo | Перепроверить версии стека перед стартом стройки: точные патч-версии живут пару недель, а TypeScript 7 и статус Drizzle 1.0 стоит сверить заново | — | 1 |
| T055 | chores | — | done | Разобраться с 4 moderate-уязвимостями npm audit в esbuild внутри drizzle-kit: только для разработки, лечится откатом drizzle-kit до 0.18 — решить, терпим или откатываем | — | 1 |
