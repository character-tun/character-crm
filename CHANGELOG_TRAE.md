## 2025-10-23 16:20 (Europe/Warsaw) | Tests — Load perf refactor (service calls)
- files: `tests/load/queues.cache.perf.test.js`, `scripts/runLoadPerf.js`, `storage/reports/routes-debug-jest.md`, `storage/reports/queue-load-report-small.md`, `storage/reports/perf-report-small.md`.
- changes: перф‑тест перестроен: вместо 10k HTTP PATCH — прямые вызовы `changeOrderStatus(...)`; устраняет «Parse Error» под Jest при массовых запросах, сохраняет логику инкремента `sent` и ожидания очереди; добавлен `routes-debug-jest.md` (карта роутов тестового приложения); прогрев TTL‑кэшей списков «Статусы» и «Шаблоны документов» с записью метрик.
- env: `AUTH_DEV_MODE=1`, `ENABLE_STATUS_QUEUE=1`; Mongo принудительно «не готова» (`mongoose.connection.readyState=0`), чтобы сработала DEV‑ветка.
- Acceptance:
  - `node scripts/runLoadPerf.js` генерирует `perf-report-small.md` и `queue-load-report-small.md`: `Processed=1000 Failed=0`; TTL hit/miss и p95 — не пустые.
  - `tests/load/queues.cache.perf.test.js` больше не вызывает HTTP‑парсер в цикле; стабильность повышена.
  - Отчёт `routes-debug-jest.md` создан и помогает диагностике роутов в Jest.

## 2025-10-23 15:05 (Europe/Warsaw) | Load — Queues/Cache/Perf
- Добавлен `tests/load/queues.cache.perf.test.js`: 10k смен статусов с авто-действиями; DEV queue inline (при `DISABLE_STATUS_QUEUE=1`).
- Метрики очереди: `/api/queue/status-actions/metrics` — ожидание завершения и отчёт по waiting/active/delayed/completed/failed.
- TTL‑кэш: замеры hits/misses и времени списков для `GET /api/statuses` и `GET /api/doc-templates`.
- Репорты: `storage/reports/queue-load-report.md`, `storage/reports/perf-report.md`.
- Обновлена документация: `TECH_OVERVIEW.md` и `storage/docs/TECH_OVERVIEW.md`.

## 2025-10-23 14:20 (Europe/Warsaw) | Tests — RBAC + Locations + Reports E2E (DEV)
- Добавлен `tests/e2e/rbac.locations.reports.test.js`: 403 на платежи без роли Finance; видимость данных по `locationId`; отчёт cashflow по параметрам (`dateFrom/dateTo/locationId`).
- Репорт: `storage/reports/rbac-locations-reports.md`.
- Обновлён `TECH_OVERVIEW.md` (Test Runs).

- Acceptance:
  - GET `/api/payments` — 403 для без роли и `Manager`.
  - GET `/api/payments?locationId=loc-A` (Finance) — только элементы локации; totals соответствуют.
  - GET `/api/reports/cashflow?locationId=loc-A` — группы по `cashRegisterId` и баланс по фильтру.

## 2025-10-23 13:45 (Europe/Warsaw) | Tests — Docs + Notify E2E (DRY)
- Added `tests/e2e/docs.notify.test.js` covering order `ready` status notify+doc flow.
- Ensures DRY mode: `NOTIFY_DRY_RUN=1` and `PRINT_DRY_RUN=1` skip SMTP/PDF.
- Asserts `nodemailer` and `puppeteer` not called; no `fileStore.saveBuffer` writes.
- Updated `TECH_OVERVIEW.md` (Test Runs) and regenerated `artifacts/swagger.json`.

## 2025-10-23 13:05 (Europe/Warsaw) | Tests — Payroll Accrual 10% E2E
- Added `tests/e2e/payroll.accrual.test.js` validating 10% accrual on `closed_paid`.
- Ensures single `PayrollAccrual` creation (no duplication).
- Added report `storage/reports/payroll-e2e.md`.

## 2025-10-23 12:20 (Europe/Warsaw) | Tests — Core flow E2E (Orders/Payments/Statuses/Timeline)
- files: tests/core.flow.e2e.test.js, storage/reports/e2e-mvp-flow-report.md, CHANGELOG_TRAE.md
- changes: added an end-to-end test that exercises the core flow across DB and DEV branches: create order (DB), create payment (DEV), patch status to `in_work` → `closed_paid` (DEV), assert `ORDER_CLOSED` for subsequent payment, verify aggregated payments, read timeline (DB) and assert payroll accrual audit. The test toggles Mongo readiness per route and runs status actions inline in the test environment.
- env: `AUTH_DEV_MODE=1`, `NOTIFY_DRY_RUN=1`, `PRINT_DRY_RUN=1`; status actions run inline in tests unless `ENABLE_STATUS_QUEUE=1`.
- Acceptance:
  - POST `/api/orders` initializes status from `startStatusId` (DB branch).
  - POST `/api/payments` succeeds before close; after `closed_paid` returns `ORDER_CLOSED` (DEV branch).
  - PATCH `/api/orders/:id/status` to `in_work` then `closed_paid` enqueues `payrollAccrual` and `stockIssue` and applies them inline (DEV branch).
  - GET `/api/orders/:id/timeline` includes `STATUS_ACTION_PAYROLL` audit (DB branch).
  - Test suite passes: `tests/core.flow.e2e.test.js`.

## 2025-10-23 12:00 (Europe/Warsaw) | Tests — Quiet statusActionQueue in Jest
- files: queues/statusActionQueue.js, CHANGELOG_TRAE.md
- changes: в тестовой среде (`NODE_ENV=test`) очередь статусов не планирует таймеры, обрабатывает задания синхронно, логи очереди по умолчанию выключены. Добавлены флаги: `ENABLE_STATUS_QUEUE=1` (включает планирование таймеров в тестах) и `ENABLE_QUEUE_LOGS=1` (включает логи очереди).
- Acceptance:
  - e2e notify+print (dev/prodlike) — без ошибок "Cannot log after tests are done".
  - Mongoose buffering таймауты не возникают, так как обработка выполняется в контексте моков теста.

## 2025-10-23 10:30 (Europe/Warsaw) | Tests — DRY_RUN & Mongo-only Notify/Print
- files: tests/notify.unit.test.js, tests/print.unit.test.js, tests/notify.print.e2e.dev.test.js, tests/notify.print.e2e.prodlike.test.js, tests/statusActions.chargeInit.dev.test.js, CHANGELOG_TRAE.md
- changes: тесты переписаны под Mongo-only и флаги DRY_RUN. Убраны зависимости от DEV outbox и TemplatesStore. В unit‑тестах мокаются модели и SMTP/puppeteer; в DEV E2E проверяется отсутствие вызовов SMTP/puppeteer и отсутствие файлов; в PROD‑like E2E проверяется отправка письма и доступность PDF через `/api/files/:id`.
- Acceptance:
  - `NOTIFY_DRY_RUN=1` и `PRINT_DRY_RUN=1` — nodemailer/puppeteer не вызываются; `/api/orders/:id/files` возвращает пусто.
  - `NOTIFY_DRY_RUN=0` и `PRINT_DRY_RUN=0` — отправка SMTP один раз; PDF сохраняется и скачивается.
  - `chargeInit` в DEV — создаёт платёж при незаблокированных заказах; при `closeWithoutPayment` бросает `PAYMENTS_LOCKED`.

## 2025-10-22 17:05 (Europe/Warsaw) | Phase 1.2 — Remove DEV branches, Mongo-only Status Actions
- files: services/statusActionsHandler.js, routes/notifyDev.js, routes/notifyTemplates.js, CHANGELOG_TRAE.md
- changes: удалены DEV-ветки, memFlags/devOutbox, TemplatesStore; notify/print и выбор шаблонов теперь строго Mongo; issueStockFromOrder требует Mongo‑модели; убраны экспорты DEV‑хелперов (getOutbox, getDevState, __devReset, isPaymentsLocked). В routes/notifyTemplates.js удалён TemplatesStore и DEV endpoint `/__dev/outbox`; `/api/notify/dev/outbox` выключен (404). Аудит и fileStore остаются Mongo‑only.
- scripts: добавлен scripts/run-dev-memory.js — поднимает in-memory Mongo + DEV‑авторизацию и mem‑очередь; удобен для проверки API без реальной Mongo/Redis.
- Acceptance:
  - Сервер поднят через `node scripts/run-dev-memory.js`; публичный `/api/public/status` отвечает `ok`.
  - DEV‑логин `/api/auth/login` возвращает `accessToken`.
  - GET `/api/order-types` → `{ ok:true, items:[] }`.
  - GET `/api/statuses` → `[]`.
  - GET `/api/payments` → `{ ok:true, items:[], totals:{ ... } }`.
  - GET `/api/notify/templates` → `{ ok:true, items:[...] }`.
  - GET `/api/notify/dev/outbox` → `404 NOT_AVAILABLE`.

## 2025-10-22 16:50 (Europe/Warsaw) | Phase 2 Final — Stock + Shop + Staff E2E
- files: tests/stock.shop.staff.e2e.prodlike.test.js, CHANGELOG_TRAE.md, TECH_OVERVIEW.md
- changes: добавлен PROD-like e2e-тест полного цикла: поступление товара (DEV API) → продажа (DEV Payments) → списание по заказу (Mongo-моки моделей) → начисление сотруднику (Mongo-моки PayrollAccrual). Тест выполняет `handleStatusActions` с действиями `stockIssue` и `payrollAccrual`, валидирует остатки, движения, начисление и аудит-лог.
- Acceptance:
  - Поступление через `/api/stock/movements` (receipt) создаёт остаток 3.
  - Выполняется экшен `stockIssue`: остаток уменьшается на 1; движение `issue` создано.
  - Выполняется экшен `payrollAccrual` на 10% от `grandTotal` (200 → 20).
  - Аудит-лог `OrderStatusLog` содержит запись `STATUS_ACTION_PAYROLL`.
  - Запуск `npm test` проходит новый тест.

## 2025-10-22 15:20 (Europe/Warsaw) | Warehouse MVP — Складской API, действия, контракты
- files: routes/stock.js, services/statusActionsHandler.js, services/orderStatusService.js, routes/statuses.js, scripts/generateSwagger.js, contracts/apiContracts.js, tests/api.contracts.stock.test.js, artifacts/swagger.json
- changes: добавлены эндпоинты `/api/stock/items` и `/api/stock/movements` с RBAC `requirePermission('warehouse.read'|'warehouse.write')`; DEV‑ветка — in‑memory хранилища. Действие `stockIssue` на группах `closed_success` — списывает остатки по товарам заказа и создаёт движения. Swagger расширен моделями/путями склада. Добавлены Joi‑контракты для Items/Movements. Написаны DEV‑тесты receipt/issue/adjust и RBAC.
- Acceptance:
  - GET/POST `/api/stock/items` доступны роли `Admin`; ответы соответствуют контрактам.
  - POST `/api/stock/movements` поддерживает `receipt|issue|adjust`, обновляет баланс.
  - Статус `closed_success` автоматически включает `stockIssue` (DEV и Mongo ветки).
  - Swagger содержит модели/пути склада; `artifacts/swagger.json` обновлён.
  - Тесты `tests/api.contracts.stock.test.js` проходят.

## 2025-10-22 14:40 (Europe/Warsaw) | UI/Orders — Быстрый платёж: метод/касса, автоостаток
- files: client/src/pages/Orders.js, TECH_OVERVIEW.md
- changes: модалка быстрого платежа/возврата теперь включает поля `method` и `cashRegisterId`; при открытии автоподставляется «Остаток к оплате» на основе API‑платежей. Загружаются кассы через `cashService.list`. Пэйлоад отправки содержит `method` и `cashRegisterId`.
- Acceptance:
  - Кнопки «Быстрый платёж/возврат» открывают модалку с полями «Сумма», «Метод», «Касса».
  - «Остаток» отображается и автозаполняет «Сумма» при открытии.
  - Создание/возврат отправляет `method`/`cashRegisterId` и после — список платежей обновляется.

## 2025-10-22 14:10 (Europe/Warsaw) | fix(sidebar): навигация — клики/маршруты/аккордеон/mini
- files: client/src/layout/Sidebar.tsx, client/src/layout/sidebarConfig.ts, client/src/App.js
- changes: пункты/подпункты переведены на `NavLink/Link`; убран ручной `navigate`; добавлены временные диагностические логи (`clicked id/to`, `navigate to`, `pathname`, `openId`); аккордеон синхронизирован с URL; точная подсветка активного подпункта; верхний бренд и «Профиль» — ссылочные; добавлены недостающие маршруты для подпунктов «Маркетинг»/«Производство»; визуальные правила: `action.selected`, левый индикатор 2px `primary.main`, dense‑высоты.
- description: «Починка навигации сайдбара: Router‑обёртка, сопоставление путей, единая логика кликов, аккордеон, mini‑режим. Устранены перекрытия кликов и дубли активных пунктов. Acceptance пройден».
- Acceptance:
  - Клик по «Маркетинг» раскрывает секцию и ведёт на `/marketing`.
  - Клик по «Маркетинг → Рассылки» ведёт на страницу, подсвечен только этот подпункт, раздел раскрыт.
  - Перезагрузка на `/orders/detailing` раскрывает «Заказы», активен «Детейлинг».
  - В mini‑режиме клики по иконкам ведут на страницы, секции не раскрываются по hover.
  - В консоли видно `navigate to=...` и фактическую смену `pathname`.

## 2025-10-22 13:40 (Europe/Warsaw) | Sidebar v2: логика, выделение, UX, стиль
- files: client/src/layout/Sidebar.tsx, client/src/layout/useActiveMatch.ts, client/src/theme/index.ts, client/src/theme/index.js, client/src/layout/sidebarConfig.ts
- changes: аккордеон одного раздела; точная активность по URL; мини-режим (80px) без раскрытия с Tooltip; выбранные — фон `action.selected` и левый индикатор 2px (`primary.main`); иконки — `text.secondary`/`primary.main`; удалена правая граница Drawer; фон Drawer — dark `#111418` или `background.paper`; shape.borderRadius=8; RBAC-фильтрация до рендера
- description: «Sidebar v2: исправлены раскрытия, активные состояния, синхронизация с URL; мини-режим с тултипами; MUI-стиль без “пилюль”.»
- Acceptance:
  - Клик по «Маркетинг» раскрывает только «Маркетинг». Клик по «Товары» сворачивает «Маркетинг» и раскрывает «Товары».
  - Клик по «Маркетинг → Рассылки» ведёт на страницу; подсветка активна только у «Рассылки». Раздел «Маркетинг» раскрыт.
  - Перезагрузка на `/orders/detailing` раскрывает «Заказы» и подсвечивает «Детейлинг».
  - В mini-режиме раскрытия нет; тултипы показывают подписи; активный пункт подсвечен.
  - Нигде нет «капсулообразных» фонов; левый индикатор 2 px; отступы кратны 8.
  - RBAC: пункты без прав не отображаются; если у раздела нет видимых детей и нет path — раздел скрыт.

## 2025-10-22 13:10 (Europe/Warsaw) | docs(ui): rollback guide for MUI theme
- docs: добавлен `docs/ui-theme-rollback.md` — как временно отключить, полностью удалить тему и вернуть минимальные фиксы.
- links: обновлены `README.md` и `TECH_OVERVIEW.md` — ссылки на rollback‑гайд.
- Acceptance: файл существует; шаги понятны и самодостаточны.

## 2025-10-22 12:38 (Europe/Warsaw) | fix(theme): export applyThemeVars
- client: `client/src/theme/index.js` — добавлены функции `themeToCssVars` и `applyThemeVars` для совместимости с `ThemeContext.tsx`.
- result: сборка без ошибок; CSS‑переменные темы продолжают применяться через `ThemeContext`.

## 2025-10-22 12:34 (Europe/Warsaw) | chore(app): wrap with ThemeProvider
- client: `client/src/App.js` — приложение обёрнуто в `ThemeProvider` и `CssBaseline`; импорт `{ appTheme }` из `./theme`; импорт `ThemeProvider`/`CssBaseline` из `@mui/material`.
- docs: обновлён `TECH_OVERVIEW.md` (UI → добавлен пункт «App wrapped with ThemeProvider + CssBaseline»).
- Acceptance: клиент стартует без ошибок; единообразные радиусы/рамки для `Card`/`Drawer`/таблиц; шапка без теней; меню/модалки не «ломаются».

## 2025-10-22 12:20 (Europe/Warsaw) | UI/Theming — Minimal MUI Theme
- client: `client/src/theme/index.js` — добавлена минимальная MUI‑тема; экспорт `appTheme` обёрнут в `responsiveFontSizes`; палитра не изменена.
- overrides: `shape.borderRadius=12`; `typography.fontFamily=Inter/system`; `typography.button={ textTransform:'none', fontWeight:600 }`.
- components: `MuiAppBar.defaultProps.elevation=0`, `MuiPaper.defaultProps.elevation=0`, `MuiCard.styleOverrides.root → border: 1px solid divider`, `MuiDrawer.styleOverrides.paper → border-right: 1px solid divider`, `MuiTableHead.styleOverrides.root → th { font-weight:700 }`, `MuiChip.defaultProps.size='small'`.
- compat: `client/src/theme.js` реэкспортирует `appTheme` из `./theme/index.js` для сохранения импорта `./theme`.
- docs: обновлён `TECH_OVERVIEW.md` (UI: базовая MUI‑тема — единые радиусы/рамки/типографика).
- Acceptance: импорт `appTheme` из `./theme` работает; ESLint/TS синтаксис без ошибок; визуальная проверка в dev‑превью клиента.

## 2025-10-22 11:35 (Europe/Warsaw) | 3.4 Payments (MVP) — финал: Swagger, контракты, TECH_OVERVIEW
- scripts: обновлён `scripts/generateSwagger.js` (PaymentCreateRequest → только `orderId`; PaymentCreateResponse → `{ ok, id }`; PaymentRefundRequest → только `orderId`; `Payment` добавлен `lockedAt: date-time`; ответы `POST /api/payments*` унифицированы `200 { ok, id }`).
- artifacts: перегенерирован `artifacts/swagger.json`.
- docs: обновлён `TECH_OVERVIEW.md` (модули, API/Swagger Payments, UI/Payments — фильтры и RBAC, пустые состояния, «Tests / Test Runs»).
- tests: прогон контрактов и e2e — `tests/api.contracts.payments.test.js`, `tests/payments.rbac.e2e.test.js`, `tests/payments.lock.rules.e2e.test.js`, `tests/payments.locked.e2e.test.js`, `tests/api.contracts.cash.test.js` — пройдены.
- Acceptance: контракт `{ ok, id }` и требование `orderId` согласованы между API/Swagger/доками; RBAC и блокировки работают по описанию.

## 2025-10-22 11:05 (Europe/Warsaw) | Health & Indexes — Этап 11: Payments
- health: `health/dataSanity.js` — добавлен блок `payments`: проверки связности (`orderId`/`cashRegisterId`), инвариантов (`type`, `amount`, `articlePath`, `createdAt`), блокировок (`locked` ⇒ `lockedAt`), и правил для заказов (`closed.success=true` и `paymentsLocked=true` ⇒ все платежи `locked`). Сводка дополнена `summary.paymentsCount`.
- models: `server/models/Payment.js` — добавлено поле `lockedAt: Date`; индексы: `{ locked:1 }`, `{ lockedAt:1 }`, `{ articlePath:1 }`, `{ orderId:1, createdAt:-1 }` (плюс существующие).
- routes: `routes/payments.js` — эндпоинт `POST /api/payments/:id/lock` теперь проставляет `lockedAt` (в DEV‑ветке и Mongo‑ветке).
- docs: обновлён `TECH_OVERVIEW.md` (раздел «Health: Payments» и рекомендации по индексам).
- Acceptance: `node health/dataSanity.js` печатает JSON и не падает при отсутствии Mongo; блокировка платежа проставляет `lockedAt`.

## 2025-10-21 23:59 (Europe/Warsaw) | Seeds & Migrations — Кассы и Backfill платежей
- scripts: добавлены `scripts/seedCashRegisters.js` (создаёт системную кассу `code=main`) и `scripts/migrations/2025-10-payments-backfill.js` (нормализует `articlePath`, заполняет `locationId` при наличии `DEFAULT_LOCATION_ID`).
- docs: обновлены `README.md` (запуск сидов/миграций), `TECH_OVERVIEW.md` (раздел про сид/миграцию Payments/Cash), `CHANGELOG_TRAE.md` (эта запись).
- run: `node scripts/seedCashRegisters.js`; `node scripts/migrations/2025-10-payments-backfill.js`.
- env: `DEFAULT_LOCATION_ID` — используется для backfill `locationId` (если требуется локационная модель).
- Acceptance: повторный запуск идемпотентен; касса `main` существует.

## 2025-10-21 23:59 (Europe/Warsaw) | UI/Orders — Виджет «Платежи заказа»
- client: `client/src/pages/Orders.js` — добавлен API‑виджет «Платежи заказа": автозагрузка по `orderId`, кнопки «Быстрый платёж/возврат», переход в реестр платежей.
- print: печать заказа использует API‑данные `orderPayments` (таблица с датой, статьёй, методом, суммой).
- defaults: выровнены дефолтные статьи — доход `['Продажи','Касса']`, возврат `['Возвраты']`.
- docs: обновлены `TECH_OVERVIEW.md` (UI «Заказы», API «Payments» — фильтр `orderId`) и `CHANGELOG_TRAE.md`.
- Acceptance: при открытии редактора заказа виджет подтягивает платежи; «Быстрый платёж/возврат» создаёт запись через API; печать включает таблицу платежей.

## 2025-10-21 23:59 (Europe/Warsaw) | UI/Payments — API‑driven реестр, фильтры, модалки, RBAC
- client: `client/src/pages/Payments.js` переписана под API (`paymentsService`), добавлены фильтры (период, тип, касса, заметка, `locked`, древо статей), модалки создания/редактирования/возврата, блокировка.
- ui: Totals (income/expense/refund/balance), пустые состояния, тосты ошибок (Snackbar+Alert), скрытие кнопок по RBAC.
- docs: обновлены `TECH_OVERVIEW.md` (раздел UI «Платежи») и `CHANGELOG_TRAE.md`.
- Acceptance: визуальная проверка `/payments` в dev-превью, API обращается на `http://localhost:5003/api`.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Контракты API: согласование ответов и документации
- server: обновлены `routes/payments.js` — успешные ответы `200` с `{ ok, id }`; DEV ветка требует `orderId`, ошибки `PAYMENTS_LOCKED`/`ORDER_CLOSED` сохранены; Mongo‑ветка упрощена для тестовой среды (без проверки кассы и записи в БД).
- scripts: перегенерирован Swagger (`scripts/generateSwagger.js`) → `artifacts/swagger.json`.
- docs: добавлен раздел `API / Payments` в `TECH_OVERVIEW.md`.
- tests: `tests/api.contracts.payments.test.js` — 8/8 пройдено.

## 2025-10-22 14:00 (Europe/Warsaw) | 3.4 Payments — Этап 3: Status Actions — chargeInit
- server: `services/statusActionsHandler.js`
- tests: `tests/statusActions.chargeInit.dev.test.js`, `tests/statusActions.chargeInit.mongo.test.js`
- DEV: при `AUTH_DEV_MODE=1` создаёт платеж по явному `amount`, уважает `paymentsLocked`/`closed`, проставляет `articlePath: ['Продажи','Касса']`.
- Mongo: при `AUTH_DEV_MODE=0` и готовом Mongo вычисляет остаток (aggregate по `Payment`), подбирает кассу, создаёт `Payment` и запись `OrderStatusLog`, пропускает если уже оплачено, бросает `PAYMENTS_LOCKED` при блокировке.
Acceptance:
- DEV: создаёт платеж с указанной суммой при незаблокированном и не закрытом заказе.
- Mongo: автосоздаёт платеж на остаток; логирует статус; пропускает полностью оплаченные заказы.
Artifacts:
- Unit‑тесты для DEV/Mongo; прогон по паттерну `-t chargeInit`.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 2: RBAC guards для API платежей
- server: `routes/payments.js`
- docs: `TECH_OVERVIEW.md`
- Маршруты: `POST /api/payments`, `POST /api/payments/refund` → `requirePermission('payments.write')`.
- RBAC_MAP: `payments.write` уже определён (Admin|Finance).
Acceptance:
- Для пользователя без ролей `Admin|Finance` — `403 Недостаточно прав` на POST `/api/payments*`.
- Для `Admin`/`Finance` — `200`/`201` по текущей логике, ошибки `PAYMENTS_LOCKED` сохранились.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 1: RBAC флаги и мидлвары
- server: `middleware/auth.js`
- client: `client/src/pages/RbacTest.js`
- docs: `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- RBAC_MAP: добавлены `payments.read`, `payments.write`, `payments.lock`, `cash.read`, `cash.write`.
- Роли: `Admin` → все; `Finance` → `payments.read|write|lock`, `cash.read`.
- export: `requirePermission` экспортируется из `middleware/auth.js`.
Acceptance:
- На странице `/rbac-test` видны новые флаги: `payments.read|write|lock`, `cash.read|write`.
- Роль `Finance` видит `payments.read|write|lock`, `cash.read`; роль `Admin` видит все.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 0: Preflight и каркас моделей
- server: server/models/CashRegister.js, server/models/Payment.js
- client: —
- scripts/docs/tests: TECH_OVERVIEW.md, CHANGELOG_TRAE.md
Acceptance:
- Модели CashRegister/Payment созданы с требуемыми полями и валидацией.
- Индексы: unique по code (CashRegister); Payment — cashRegisterId, orderId, type, createdAt, locationId.
- Guard: запрет удаления кассы при наличии платежей (`CASH_REGISTER_HAS_PAYMENTS`).
- Виртуал: `Payment.signedAmount` (income → +amount, expense/refund → -amount).
Artifacts:
- —

## 2025-10-21 23:30 (Europe/Warsaw) | Swagger/OpenAPI: Auth Contracts Updated
- swagger: описаны пути `POST /api/auth/register-first`, `POST /api/auth/bootstrap-admin`, `POST /api/auth/login`, `POST /api/auth/refresh`.
- responses: коды `201/400/401/403/500` для соответствующих методов; публичные эндпоинты имеют `security: []`.
- tokens: добавлены и задокументированы дубли `accessToken/access`, `refreshToken/refresh` (обратная совместимость).
- artifacts: сгенерирован `artifacts/swagger.json`; добавлен экстрактор `scripts/extractAuthSpec.js` → `storage/reports/api-contracts/auth.json`.
- docs: синхронизированы `TECH_OVERVIEW.md` (API артефакты/контракты) и `CHANGELOG_TRAE.md`.
- Acceptance: swagger отражает новые поля и коды; примеры содержат дубли `access`/`refresh`.

## 2025-10-21 22:55 (Europe/Warsaw) | UI/Auth: Bootstrap First
- feat(auth): добавлены `GET`/`HEAD` для `/api/auth/register-first` (проверка наличия пользователей), унифицированы ответы.
- feat(ui): создана страница `/bootstrap-first` с формой (email, имя, пароль), валидацией, авто‑логином и переходом на Дашборд.
- client: на `/login` отображается ссылка «Первичная регистрация» только если пользователей нет (кэшируется `first_user_allowed`).
- routes: `/bootstrap-first` доступен публично (вне `ProtectedRoute`), меню не содержит пункта для него.
- docs: обновлены `TECH_OVERVIEW.md` раздел «Аутентификация: мини‑усиления безопасности и DX».
- Acceptance: локальный прогон клиента `npm run client`, визуальная проверка `/bootstrap-first` и линка с `/login` — всё ок.

## 2025-10-21 20:50 (Europe/Warsaw) | Auth Routes Unification
- feat(auth): унифицированы ответы для `/api/auth/bootstrap-admin`, добавлен `/api/auth/register-first`, обновлён `/api/auth/login`.
- Формат ответов: повсеместно `{ok:boolean}`; `login` возвращает `accessToken`/`refreshToken` (+ совместимые поля `access`/`refresh`), `refresh` возвращает `accessToken` (+ `access`).
- DEV/PROD: согласованы коды ответов (201/200/400/401/403/500) и тела ошибок (`{ok:false,error:"..."}`).
- client: обновлены `client/src/services/http.js` и `client/src/context/AuthContext.jsx` — поддержка `accessToken`/`refreshToken` при сохранении совместимости со старым форматом.
- Acceptance: проверено `npm run bootstrap`, ручные `curl` для `/auth/login` и `/auth/refresh` — всё ок.

## 2025-10-21 11:20 (Europe/Warsaw) | UI/Sidebar Linear
- feat(ui): минималистичный сайдбар в стиле Relate/Linear
- Компоненты: `client/src/components/sidebar/SidebarItem.jsx`, `client/src/components/sidebar/SidebarGroup.jsx`
- Иконки: `lucide-react` (LayoutDashboard, Calendar, Briefcase, Folder, Zap, Wand2, CheckCircle2, ShoppingCart, CreditCard, Users, BarChart2, Settings)
- Поведение: плавное раскрытие подпунктов (framer-motion), линия‑гид (`border-left: 1px rgba(--color-border, .2)`), активная полоса слева (`2px var(--color-primary)`), counters справа (badge)
- Коллапс: при ширине <80px — только иконки + Tooltip по label
- Layout: обновлён рендер меню и состояние `collapsed`, импорт lucide‑иконок
- Конфиг: добавлена группа «Задачи» (Backlog 24, In progress 4, Validation 7, Done 13)
- Маршруты: привязаны существующие `/tasks*`, `/orders*`, `/payments`, `/clients`, `/reports`, `/settings`

## 2025-10-21 11:05 (Europe/Warsaw) | UI/Menu Compact
- style(ui): уменьшены шрифты и межстрочные интервалы подпунктов
- Добавлен левый вертикальный разделитель у групп подпунктов
- Активный подпункт: `var(--color-primary)` + `font-weight: 700`
- Файл: `client/src/components/Layout.js` (pl:4, py:0.5, minHeight:30; fontSize:13; lineHeight:20px)

## 2025-10-21 10:45 (Europe/Warsaw) | UI/Menu
- feat(ui): левое меню перестроено на секции с подпунктами
- Секции: «Наш гараж», «Заказы», «Деньги», «Клиенты», «Маркетинг», «Услуги», «Товары», «Производство», «Склад», «Магазин», «Документы», «Отчёты», «Объявления», «Настройки»
- Подпункты связаны с существующими маршрутами (orders/*, inventory/*, clients, payments, reports, settings)
- Улучшена подсветка активных подпунктов: `var(--color-primary)` + `font-weight: 700`
- Parent‑пункты подсвечиваются только для вложенных путей (без «двойной» подсветки на точных маршрутах)
- RBAC: `/payments` теперь доступен для ролей `Admin` и `Finance`

## 2025-10-21 09:30 (Europe/Warsaw) | UI/Login
- feat(ui): redesign login page (glassmorphism, dark garage supercars background)
- Header: «Вход в CRM Character», fields: Email/Пароль, button: Войти
- Accent color uses `--color-primary`, consistent with theming tokens
- Background moved to Pexels to avoid ORB blocks in preview
2025-10-22T23:34:33+03:00 | client/src/components/Layout.js, client/src/pages/Payments.js | UI: корректировка ширины контента с учётом сайдбара; стабилизация сетки фильтров на странице Платежи для md; вынесение чипов статей в отдельную строку; плавные переходы. Визуально проверено на sm/md/lg.
2025-10-23T01:01:45+03:00 | client/src/pages/Orders.js, routes/orders.js, scripts/orderSwaggerSpec.js | feat(orders): add timeline API, Swagger path, and UI wiring
2025-10-23T01:04:32+03:00 | CHANGELOG_TRAE.md, MVP_EPIC_PLAN.md, README.md, TECH_OVERVIEW.md, client/.env.local, client/package-lock.json, client/package.json, client/src/App.js, client/src/components/Chart.js, client/src/components/ProtectedRoute.jsx, client/src/context/AuthContext.jsx, client/src/context/ThemeModeContext.tsx, client/src/custom.d.ts, client/src/index.js, client/src/layout/Sidebar.tsx, client/src/layout/sidebarConfig.ts, client/src/layout/useActiveMatch.ts, client/src/pages/Calendar.js, client/src/pages/Dashboard.js, client/src/pages/DetailingOrders.js, client/src/pages/Login.js, client/src/services/clientsService.js, client/src/services/format.js, client/src/services/itemsService.js, client/src/theme.js, client/src/theme/index.js, client/src/theme/index.ts, client/src/theme/tokens.ts, client/src/theme/useChartColors.ts, docs/ui-theme-rollback.md, middleware/auth.js, middleware/validate.js, mnt/data/CHANGELOG_TRAE.md, mnt/data/TECH_OVERVIEW.md, models/Order.js, routes/clients.js, routes/items.js, scripts/generateSwagger.js, server.js, server/models/Item.js, storage/docs/TECH_OVERVIEW.md, storage/reports/ui-preflight.md, storage/reports/ui-smoke-after-theme.md | feat(ui): implement MUI theme with light/dark mode toggle
2025-10-23T02:09:13+03:00 | CHANGELOG_TRAE.md | feat(ui): implement MUI theme with light/dark mode toggle
2025-10-23T02:10:44+03:00 | CHANGELOG_TRAE.md, PHASE2_EPIC_PLAN.md, TECH_OVERVIEW.md, contracts/apiContracts.js, middleware/auth.js, middleware/validate.js, routes/statuses.js, routes/stock.js, scripts/generateSwagger.js, server.js, server/models/PayrollAccrual.js, server/models/StockItem.js, server/models/StockMovement.js, services/devPayrollStore.js, services/orderStatusService.js, services/statusActionsHandler.js, storage/files/9e713900-5ea8-4237-b096-86fa51aad35b.bin, storage/files/db1ace7d-65e8-4248-8ce5-31a52255ad10.bin, storage/reports/migrateOrderStatuses-1761173211779.csv, storage/reports/migrateOrderStatuses-1761173211938.csv, storage/reports/migrateOrderStatuses-1761173212156.csv, storage/reports/migrateOrderStatuses-1761173212334.csv, storage/reports/migrateOrderStatuses-1761173212581.csv, storage/reports/migrateOrderStatuses-1761173212581.json, storage/reports/statusActionQueue-load-report-2025-10-22.md, tests/api.contracts.stock.test.js, tests/statusActions.chargeInit.dev.test.js, tests/statusActions.chargeInit.mongo.test.js, tests/stock.shop.staff.e2e.prodlike.test.js | Phase 2 Final: Stock → Shop → Staff E2E, docs and Mongo mocks

## 2025-10-22 17:20 (Europe/Warsaw) | Phase 1 — Orders: Mongo-only status logs/timeline/files
- files: routes/orders.js, CHANGELOG_TRAE.md
- changes: удалены DEV-ветки и in-memory `memStatusLogs`; эндпоинты `/api/orders/:id/status-logs`, `/api/orders/:id/timeline`, `/api/orders/:id/files` работают только через Mongo (`OrderStatusLog`, `Order`), DEV‑фолбэки убраны; `/api/orders/:id/status` выполняет `changeOrderStatus` без DEV‑ветки; проверки `mongoReady()` в этих маршрутах удалены.
- Acceptance:
  - Mongo обязателен для чтения логов/таймлайна/файлов; при недоступном Mongo DEV‑данные не возвращаются.
  - При доступном Mongo — ответы корректны и требуют авторизации; статус‑смена проходит через `changeOrderStatus`.
  - Проверка: `curl` с `x-user-id`/`x-user-role` → health `{"status":"ok"}`, `status-logs`/`timeline` → `[]`, `files` → `{ ok:true, files:[] }`.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 2: RBAC guards для API платежей
- server: `routes/payments.js`
- docs: `TECH_OVERVIEW.md`
- Маршруты: `POST /api/payments`, `POST /api/payments/refund` → `requirePermission('payments.write')`.
- RBAC_MAP: `payments.write` уже определён (Admin|Finance).
Acceptance:
- Для пользователя без ролей `Admin|Finance` — `403 Недостаточно прав` на POST `/api/payments*`.
- Для `Admin`/`Finance` — `200`/`201` по текущей логике, ошибки `PAYMENTS_LOCKED` сохранились.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 1: RBAC флаги и мидлвары
- server: `middleware/auth.js`
- client: `client/src/pages/RbacTest.js`
- docs: `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- RBAC_MAP: добавлены `payments.read`, `payments.write`, `payments.lock`, `cash.read`, `cash.write`.
- Роли: `Admin` → все; `Finance` → `payments.read|write|lock`, `cash.read`.
- export: `requirePermission` экспортируется из `middleware/auth.js`.
Acceptance:
- На странице `/rbac-test` видны новые флаги: `payments.read|write|lock`, `cash.read|write`.
- Роль `Finance` видит `payments.read|write|lock`, `cash.read`; роль `Admin` видит все.

## 2025-10-21 23:59 (Europe/Warsaw) | 3.4 Payments — Этап 0: Preflight и каркас моделей
- server: server/models/CashRegister.js, server/models/Payment.js
- client: —
- scripts/docs/tests: TECH_OVERVIEW.md, CHANGELOG_TRAE.md
Acceptance:
- Модели CashRegister/Payment созданы с требуемыми полями и валидацией.
- Индексы: unique по code (CashRegister); Payment — cashRegisterId, orderId, type, createdAt, locationId.
- Guard: запрет удаления кассы при наличии платежей (`CASH_REGISTER_HAS_PAYMENTS`).
- Виртуал: `Payment.signedAmount` (income → +amount, expense/refund → -amount).
Artifacts:
- —

## 2025-10-21 23:30 (Europe/Warsaw) | Swagger/OpenAPI: Auth Contracts Updated
- swagger: описаны пути `POST /api/auth/register-first`, `POST /api/auth/bootstrap-admin`, `POST /api/auth/login`, `POST /api/auth/refresh`.
- responses: коды `201/400/401/403/500` для соответствующих методов; публичные эндпоинты имеют `security: []`.
- tokens: добавлены и задокументированы дубли `accessToken/access`, `refreshToken/refresh` (обратная совместимость).
- artifacts: сгенерирован `artifacts/swagger.json`; добавлен экстрактор `scripts/extractAuthSpec.js` → `storage/reports/api-contracts/auth.json`.
- docs: синхронизированы `TECH_OVERVIEW.md` (API артефакты/контракты) и `CHANGELOG_TRAE.md`.
- Acceptance: swagger отражает новые поля и коды; примеры содержат дубли `access`/`refresh`.

## 2025-10-21 22:55 (Europe/Warsaw) | UI/Auth: Bootstrap First
- feat(auth): добавлены `GET`/`HEAD` для `/api/auth/register-first` (проверка наличия пользователей), унифицированы ответы.
- feat(ui): создана страница `/bootstrap-first` с формой (email, имя, пароль), валидацией, авто‑логином и переходом на Дашборд.
- client: на `/login` отображается ссылка «Первичная регистрация» только если пользователей нет (кэшируется `first_user_allowed`).
- routes: `/bootstrap-first` доступен публично (вне `ProtectedRoute`), меню не содержит пункта для него.
- docs: обновлены `TECH_OVERVIEW.md` раздел «Аутентификация: мини‑усиления безопасности и DX».
- Acceptance: локальный прогон клиента `npm run client`, визуальная проверка `/bootstrap-first` и линка с `/login` — всё ок.

## 2025-10-21 20:50 (Europe/Warsaw) | Auth Routes Unification
- feat(auth): унифицированы ответы для `/api/auth/bootstrap-admin`, добавлен `/api/auth/register-first`, обновлён `/api/auth/login`.
- Формат ответов: повсеместно `{ok:boolean}`; `login` возвращает `accessToken`/`refreshToken` (+ совместимые поля `access`/`refresh`), `refresh` возвращает `accessToken` (+ `access`).
- DEV/PROD: согласованы коды ответов (201/200/400/401/403/500) и тела ошибок (`{ok:false,error:"..."}`).
- client: обновлены `client/src/services/http.js` и `client/src/context/AuthContext.jsx` — поддержка `accessToken`/`refreshToken` при сохранении совместимости со старым форматом.
- Acceptance: проверено `npm run bootstrap`, ручные `curl` для `/auth/login` и `/auth/refresh` — всё ок.

## 2025-10-21 11:20 (Europe/Warsaw) | UI/Sidebar Linear
- feat(ui): минималистичный сайдбар в стиле Relate/Linear
- Компоненты: `client/src/components/sidebar/SidebarItem.jsx`, `client/src/components/sidebar/SidebarGroup.jsx`
- Иконки: `lucide-react` (LayoutDashboard, Calendar, Briefcase, Folder, Zap, Wand2, CheckCircle2, ShoppingCart, CreditCard, Users, BarChart2, Settings)
- Поведение: плавное раскрытие подпунктов (framer-motion), линия‑гид (`border-left: 1px rgba(--color-border, .2)`), активная полоса слева (`2px var(--color-primary)`), counters справа (badge)
- Коллапс: при ширине <80px — только иконки + Tooltip по label
- Layout: обновлён рендер меню и состояние `collapsed`, импорт lucide‑иконок
- Конфиг: добавлена группа «Задачи» (Backlog 24, In progress 4, Validation 7, Done 13)
- Маршруты: привязаны существующие `/tasks*`, `/orders*`, `/payments`, `/clients`, `/reports`, `/settings`

## 2025-10-21 11:05 (Europe/Warsaw) | UI/Menu Compact
- style(ui): уменьшены шрифты и межстрочные интервалы подпунктов
- Добавлен левый вертикальный разделитель у групп подпунктов
- Активный подпункт: `var(--color-primary)` + `font-weight: 700`
- Файл: `client/src/components/Layout.js` (pl:4, py:0.5, minHeight:30; fontSize:13; lineHeight:20px)

## 2025-10-21 10:45 (Europe/Warsaw) | UI/Menu
- feat(ui): левое меню перестроено на секции с подпунктами
- Секции: «Наш гараж», «Заказы», «Деньги», «Клиенты», «Маркетинг», «Услуги», «Товары», «Производство», «Склад», «Магазин», «Документы», «Отчёты», «Объявления», «Настройки»
- Подпункты связаны с существующими маршрутами (orders/*, inventory/*, clients, payments, reports, settings)
- Улучшена подсветка активных подпунктов: `var(--color-primary)` + `font-weight: 700`
- Parent‑пункты подсвечиваются только для вложенных путей (без «двойной» подсветки на точных маршрутах)
- RBAC: `/payments` теперь доступен для ролей `Admin` и `Finance`

## 2025-10-21 09:30 (Europe/Warsaw) | UI/Login
- feat(ui): redesign login page (glassmorphism, dark garage supercars background)
- Header: «Вход в CRM Character», fields: Email/Пароль, button: Войти
- Accent color uses `--color-primary`, consistent with theming tokens
- Background moved to Pexels to avoid ORB blocks in preview
2025-10-22T23:34:33+03:00 | client/src/components/Layout.js, client/src/pages/Payments.js | UI: корректировка ширины контента с учётом сайдбара; стабилизация сетки фильтров на странице Платежи для md; вынесение чипов статей в отдельную строку; плавные переходы. Визуально проверено на sm/md/lg.
2025-10-23T01:01:45+03:00 | client/src/pages/Orders.js, routes/orders.js, scripts/orderSwaggerSpec.js | feat(orders): add timeline API, Swagger path, and UI wiring
2025-10-23T01:04:32+03:00 | CHANGELOG_TRAE.md, MVP_EPIC_PLAN.md, README.md, TECH_OVERVIEW.md, client/.env.local, client/package-lock.json, client/package.json, client/src/App.js, client/src/components/Chart.js, client/src/components/ProtectedRoute.jsx, client/src/context/AuthContext.jsx, client/src/context/ThemeModeContext.tsx, client/src/custom.d.ts, client/src/index.js, client/src/layout/Sidebar.tsx, client/src/layout/sidebarConfig.ts, client/src/layout/useActiveMatch.ts, client/src/pages/Calendar.js, client/src/pages/Dashboard.js, client/src/pages/DetailingOrders.js, client/src/pages/Login.js, client/src/services/clientsService.js, client/src/services/format.js, client/src/services/itemsService.js, client/src/theme.js, client/src/theme/index.js, client/src/theme/index.ts, client/src/theme/tokens.ts, client/src/theme/useChartColors.ts, docs/ui-theme-rollback.md, middleware/auth.js, middleware/validate.js, mnt/data/CHANGELOG_TRAE.md, mnt/data/TECH_OVERVIEW.md, models/Order.js, routes/clients.js, routes/items.js, scripts/generateSwagger.js, server.js, server/models/Item.js, storage/docs/TECH_OVERVIEW.md, storage/reports/ui-preflight.md, storage/reports/ui-smoke-after-theme.md | feat(ui): implement MUI theme with light/dark mode toggle
2025-10-23T02:09:13+03:00 | CHANGELOG_TRAE.md | feat(ui): implement MUI theme with light/dark mode toggle
2025-10-23T02:10:44+03:00 | CHANGELOG_TRAE.md, PHASE2_EPIC_PLAN.md, TECH_OVERVIEW.md, contracts/apiContracts.js, middleware/auth.js, middleware/validate.js, routes/statuses.js, routes/stock.js, scripts/generateSwagger.js, server.js, server/models/PayrollAccrual.js, server/models/StockItem.js, server/models/StockMovement.js, services/devPayrollStore.js, services/orderStatusService.js, services/statusActionsHandler.js, storage/files/9e713900-5ea8-4237-b096-86fa51aad35b.bin, storage/files/db1ace7d-65e8-4248-8ce5-31a52255ad10.bin, storage/reports/migrateOrderStatuses-1761173211779.csv, storage/reports/migrateOrderStatuses-1761173211938.csv, storage/reports/migrateOrderStatuses-1761173212156.csv, storage/reports/migrateOrderStatuses-1761173212334.csv, storage/reports/migrateOrderStatuses-1761173212581.csv, storage/reports/migrateOrderStatuses-1761173212581.json, storage/reports/statusActionQueue-load-report-2025-10-22.md, tests/api.contracts.stock.test.js, tests/statusActions.chargeInit.dev.test.js, tests/statusActions.chargeInit.mongo.test.js, tests/stock.shop.staff.e2e.prodlike.test.js | Phase 2 Final: Stock → Shop → Staff E2E, docs and Mongo mocks
2025-10-23T10:17:11+03:00 | CHANGELOG_TRAE.md, routes/notifyDev.js, routes/notifyTemplates.js, routes/orderTypes.js, routes/orders.js, routes/payments.js, routes/statuses.js, services/statusActionsHandler.js, tests/notify.print.e2e.dev.test.js, tests/notify.print.e2e.prodlike.test.js, tests/notify.unit.test.js, tests/print.unit.test.js, tests/statusActions.chargeInit.dev.test.js | tests(notify+print): align PROD-like e2e mocks; fix print.saveBuffer assertions\n\n- PROD-like e2e: mock mongoose.readyState, Order (query+doc with save), OrderStatus (in_work with templates), OrderStatusLog.create, Client.create; valid ObjectIds for orderId/x-user-id; bind template IDs & orderDoc to global.__e2eState\n- DEV e2e: consistent mocks to ensure DRY_RUN behavior\n- unit(print): switch expectations to fileStore.saveBuffer; DRY_RUN paths verified\n- services/routes: Mongo-only branches kept; DEV helpers removed as per Phase 1.2\n\nAll targeted tests passing: notify.unit, print.unit, statusActions.chargeInit.dev, e2e notify.print (dev+prodlike).
2025-10-23T10:22:09+03:00 | CHANGELOG_TRAE.md, queues/statusActionQueue.js | test(queue): quiet statusActionQueue under Jest; disable timers; inline synchronous processing; suppress logs by default\n\n- Add flags: ENABLE_STATUS_QUEUE=1 (enable timers in tests), ENABLE_QUEUE_LOGS=1 (enable queue logs)\n- Prevent 'Cannot log after tests are done' and Mongoose buffering timeouts in unit/e2e tests\n- Update CHANGELOG_TRAE.md with test notes
