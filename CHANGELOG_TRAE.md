## 2025-10-25 10:45 (Europe/Warsaw) | Client — Payments UI: Modal refactor + EmptyState + routes cleanup

- files: `client/src/pages/Payments.js`, `client/src/components/PaymentDialog.jsx`, `client/src/components/EmptyState.jsx`, `client/src/App.js`, `client/src/pages/Settings.js`, `CHANGELOG_TRAE.md`
- changes: заменены легаси-диалоги платежей на универсальный `PaymentDialog` (create/edit/refund) с внутренним выбором статьи; добавлен `EmptyState` для пустых выборок; очищены дифф-маркеры, исправлен `onRowClick` в `DataGridBase`, удалено устаревшее состояние `form`; в `App.js` очищены маршруты `shop`/`shop/history`, добавлен `pricing`; в `Settings.js` исправлен пункт «Правила начислений».
- Acceptance:
  - `/payments` открывается без ошибок; создание/редактирование/возврат работают в унифицированной модалке.
  - Выбор статьи работает внутри модалки; список выбранных статей (Chip) отображается корректно.
  - Фильтры (дата/тип/касса/локация/статьи/заметка/блокировка) влияют на список; итоги пересчитываются.
  - Превью клиента доступно по `http://localhost:3001/payments`.

## 2025-10-24 14:30 (Europe/Warsaw) | Client — Payroll: Service + UI + routes + sidebar

- files: `client/src/services/payrollService.js`, `client/src/pages/settings/PayrollRules.js`, `client/src/pages/reports/Payroll.js`, `client/src/App.js`, `client/src/pages/Settings.js`, `client/src/layout/sidebarConfig.ts`, `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: добавлен клиентский сервис Payroll (правила/начисления), страницы UI для правил начислений (CRUD) и реестр начислений, маршруты `/settings/payroll/rules` и `/reports/payroll`, пункт сайдбара «Отчёты → Начисления», обновлена документация.
- Acceptance:
  - `/settings/payroll/rules` доступна `Admin|Finance`, отображает список правил, создание/удаление работает.
  - `/reports/payroll` доступен `Admin|Manager|Finance`, загружает реестр начислений, кнопка «Обновить» перезагружает данные.
  - Сайдбар показывает «Отчёты → Начисления»; переход работает.

## 2025-10-24 13:15 (Europe/Warsaw) | CI — Jest coverage gates (60/60/45/50)
- files: `jest.config.js`, `package.json`, `.github/workflows/ci.yml`, `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: добавлены пороги покрытия в Jest (`coverageThreshold`), скрипт `test:cov`, и отдельный CI‑шаг; документация обновлена (раздел Tests/Thresholds).
- Acceptance:
  - `npm run test:cov` запускает Jest с покрытием и падает при нарушении порогов.
  - В CI шаг `Coverage gates (Jest)` блокирует пайплайн при недостающем покрытии.
  - Раздел TECH_OVERVIEW.md → Tests/Thresholds отражает текущую политику порогов.

## 2025-10-24 12:20 (Europe/Warsaw) | Server — Payments: ENV flags (refund/default cash/strict lock) + tests + docs
- files: `routes/payments.js`, `services/paymentsService.js`, `services/configValidator.js`, `.env.example`, `tests/payments.flags.refund.e2e.test.js`, `tests/payments.flags.lock.strict.e2e.test.js`, `tests/payments.flags.defaultCash.e2e.test.js`, `TECH_OVERVIEW.md`, `storage/docs/TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: добавлены ENV‑флаги платежей: `PAYMENTS_REFUND_ENABLED` (гейт возвратов), `DEFAULT_CASH_REGISTER` (автозаполнение кассы по id/code для create/refund), `CASH_LOCK_STRICT` (строгий запрет `PATCH` залоченных); обновлены валидатор и `.env.example`; добавлены e2e‑тесты и документация.
- Acceptance:
  - `PAYMENTS_REFUND_ENABLED=0` → `POST /api/payments/refund` → 403 `REFUND_DISABLED`
  - `CASH_LOCK_STRICT=1` → `PATCH /api/payments/:id` залоченного → 403 `PAYMENT_LOCKED` даже при `payments.lock`
  - `DEFAULT_CASH_REGISTER` (id или `code`) используется по умолчанию для create/refund; DEV‑ветка падает в `dev-main`, если не задано.

## 2025-10-24 03:55 (Europe/Warsaw) | Artifacts — Payments spec extractor
- files: `scripts/extractPaymentsSpec.js`, `storage/reports/api-contracts/payments.json`, `package.json`, `README.md`, `TECH_OVERVIEW.md`
- changes: добавлен экстрактор подмножества OpenAPI для платежей; добавлен npm-скрипт `extract:payments`; документация обновлена; выполнен прогон генератора Swagger и экстрактора.
- Paths (extracted): `/api/payments`, `/api/payments/refund`, `/api/payments/{id}`, `/api/payments/{id}/lock`.
- Schemas (included): `PaymentCreateRequest`, `PaymentCreateResponse`, `Payment`, `PaymentItemResponse`, `PaymentsListResponse`, `PaymentRefundRequest`, `PaymentPatchRequest`.

## 2025-10-24 03:30 (Europe/Warsaw) | Server — Payments: Swagger/Contracts aligned (MVP Final)
- files: `scripts/generateSwagger.js`, `artifacts/swagger.json`, `TECH_OVERVIEW.md`, `storage/docs/TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`, `tests/api.contracts.payments.test.js`
- changes: выровнены коды ответов и схемы для `POST /api/payments` и `POST /api/payments/refund`: `200 OK + PaymentCreateResponse { ok, id }`; удалён `201 Created` из Swagger; регенерирован `artifacts/swagger.json`; TECH_OVERVIEW отражает договорённости; тесты контрактов подтверждают `200`.
- Acceptance:
  - Swagger: `POST /api/payments` и `POST /api/payments/refund` → `200` с `PaymentCreateResponse`.
  - Тесты контрактов платежей проходят и ожидают `200`.
  - `POST /api/cash` остаётся `201 Created` — документация и реализация совпадают.


## 2025-10-24 00:35 (Europe/Warsaw) | RBAC — Payments: Map + UI visibility
- files: `middleware/auth.js`, `client/src/layout/sidebarConfig.ts`, `client/src/layout/AppShell.tsx`, `TECH_OVERVIEW.md`, `storage/docs/TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: обновлён серверный `RBAC_MAP` (Payments/Cash): `payments.read` включает `Manager`, `cash.write` ограничен `Admin`, `cash.read` для `Admin|Finance`; на клиенте скрыт пункт меню «Деньги → Платежи» для `Manager` (виден `Admin|Finance`), а для `Admin` добавлена суперакция на все role‑гейты; документация TECH_OVERVIEW обновлена.
- Acceptance:
  - Меню «Деньги → Платежи» отображается только для `Admin|Finance`
  - `Manager` видит `payments.read` в API, но не видит пункт меню
  - Сервер строго применяет новые права `cash.read`/`cash.write`
  - Превью клиента открывается без ошибок

## 2025-10-24 00:10 (Europe/Warsaw) | Client — Payments UI: Location filter, row color coding, delete action
- files: `client/src/pages/Payments.js`, `client/src/services/paymentsService.js`, `TECH_OVERVIEW.md`, `storage/docs/TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: добавлен фильтр по локации (`locationId`), цветовая индикация строк в таблице (`income`/`expense`/`refund`), кнопка удаления платежа с подтверждением и RBAC (только Admin); сервис `paymentsService` расширен методом `remove(id)`; технический обзор обновлён.
- Acceptance:
  - Фильтр по локации влияет на загрузку платежей и мини‑отчёт по кассам
  - В таблице Payments строки подсвечены по типу операции
  - Кнопка удаления доступна только для разблокированных платежей и роли Admin
  - Превью клиента открывается без ошибок, UI в рабочем состоянии

## 2025-10-23 23:59 (Europe/Warsaw) | Server — Payments: Business Rules (refund/lock) + Audit
- files: `services/paymentsService.js`, `routes/payments.js`, `storage/docs/TECH_OVERVIEW.md`, `tests/payments.rules.e2e.test.js`, `CHANGELOG_TRAE.md`
- changes: реализованы бизнес‑правила для платежей: `create/update/refund/lock` с ограничениями — запрещено добавлять для закрытых/заблокированных заказов; PATCH запрещает поля `locked/lockedAt` и смену `type`; блокировка доступна только через `POST /api/payments/:id/lock`; все операции пишут Audit в `OrderStatusLog`. Refund: `type='refund'`, сумма учитывается как отрицательная в своде (`totals.balance` уменьшается).
- Acceptance:
  - `POST /api/payments/refund` → `200 + { ok, id }`; итоговый баланс уменьшается на сумму возврата.
  - `PATCH /api/payments/:id { locked: true }` → `400 VALIDATION_ERROR`; `POST /api/payments/:id/lock` → `200` устанавливает `locked=true`, `lockedAt`.
  - `storage/docs/TECH_OVERVIEW.md` обновлён (Business Rules → Payments).

## 2025-10-23 23:58 (Europe/Warsaw) | Server — Payments: RBAC + Swagger DELETE
- files: `routes/payments.js`, `scripts/generateSwagger.js`, `storage/docs/TECH_OVERVIEW.md`, `artifacts/swagger.json`, `CHANGELOG_TRAE.md`
- changes: документирован и добавлен в Swagger `DELETE /api/payments/{id}` (Admin only), проверка `PAYMENT_LOCKED` → `400`; обновлены RBAC-правила: `cash.read`/`payments.read` включают роль `Manager`, `cash.write` включает роль `Finance`; `TECH_OVERVIEW.md` обновлён.
- Acceptance:
  - `DELETE /api/payments/:id` → `200` (Admin), `403` (без прав), `400 PAYMENT_LOCKED`, `404` (нет такого id).
  - `artifacts/swagger.json` содержит путь `/api/payments/{id}` с операцией `delete` и корректными схемами ответов.
  - `TECH_OVERVIEW.md` отражает новые RBAC.

## 2025-10-23 23:25 (Europe/Warsaw) | Server — Payments/Cash: cashierMode → 'manual'/'auto'; CashRegister: добавлен 'locationId'; Payment: индекс { locationId, type }
## 2025-10-23 23:10 (Europe/Warsaw) | UI — Этап 14: Миграция страниц завершена
- files: `client/src/pages/settings/Users.js`, `client/src/pages/Payments.js`, `CHANGELOG_TRAE.md`
- changes: все страницы ERP приведены к единому виду темы MUI: контент обёрнут в `Box`/`Paper`, формы и кнопки — на `TextField`/`Button`/`Switch`, таблицы — на `Table`/`TableRow`/`TableCell`. Легаси-участки заменены: Users — форма создания и таблица управления пользователями/ролями переписаны на MUI; Payments — нативный `input[type=checkbox]` в диалоге выбора статей заменён на `Checkbox` + `FormControlLabel`.
- Acceptance:
  - интерфейс единообразен на всех страницах
  - в консоли нет ошибок
  - визуальная проверка пройдена на превью клиента

## 2025-10-23 22:45 (Europe/Warsaw) | UI — Этап 13: Добавлен UI-kit docs
- files: `docs/ui-kit.md`, `CHANGELOG_TRAE.md`
- changes: создано понятное руководство по использованию новой темы: токены (`palette`, `typography`, `spacing`, `shape`), компонентные пресеты (Button, AppBar, Drawer, TextField, Card, Tabs/Tab, Table), чек-лист новой страницы, анти‑паттерны с корректными примерами. Все примеры адаптированы под текущую тему из `client/src/theme/index.ts` и компоненты проекта (`FormField`, `DataGridBase`).
- Acceptance:
  - Документ доступен по пути `docs/ui-kit.md` и легко читается командой
  - Все примеры компилируются в проекте без ошибок
  - Правило `no-hardcoded-ui` учитывается как часть анти‑паттернов

## 2025-10-23 22:20 (Europe/Warsaw) | Lint — Этап 12: Введён линт-контроль UI
- files: `client/eslint-rules/no-hardcoded-ui.js`, `client/eslint-rules/index.js`, `client/eslint.config.cjs`, `.github/workflows/ci.yml`, `CHANGELOG_TRAE.md`
- changes: добавлено кастомное правило ESLint `no-hardcoded-ui`, запрещающее хардкод hex-цветов (`#RGB/#RRGGBB`) и `px`-единиц в UI-коде. Исключены svg-иконки: полностью игнорируются файлы `*.svg`, а также строки внутри JSX-иконок (`<svg>`, `<SvgIcon>`, компоненты, оканчивающиеся на `...Icon`). Правило подключено в клиентском ESLint (по умолчанию выключено для локальной разработки); в CI добавлен PR‑гейт, который включает правило как `error` для изменённых файлов под `client/src/` и блокирует PR при нарушениях.
- Acceptance:
  - PR с хардкодом (`#fff`, `12px`) в `client/src` — завершается ошибкой линта и блокируется.
  - SVG‑иконки и inline‑иконки в JSX не попадают под проверку.
  - Локально `npx eslint` работает как прежде (правило по умолчанию `off`).
  - В CI в job `lint` появился отдельный gate‑step на UI‑правила.

## 2025-10-23 21:30 (Europe/Warsaw) | UI — Этап 9: Диалоги унифицированы (ModalBase)
- files: `client/src/components/ModalBase.tsx`, `client/src/pages/Orders.js`, `client/src/pages/DetailingOrders.js`, `client/src/pages/settings/Employees.js`, `client/src/pages/settings/Documents.js`
- changes: заменены MUI `Dialog` на единый `ModalBase` в диалогах: Orders → «Новый клиент» и «Новая позиция каталога», DetailingOrders → «Создать новый заказ», Настройки → «Добавить сотрудника», Настройки → «Документ». Заголовок, кнопка закрытия, ширина и зона действий теперь стандартные; контент сохранён без изменений. В Orders добавлены тосты через `useNotify`: успех/ошибка для `submitPaymentModal`, `submitNewClient`, `submitNewItem`.
- Acceptance:
  - модалки выглядят одинаково: заголовок, крестик, отступы, ширина
  - `Esc` и фон закрывают модалку, `onClose` работает
  - после операций в Orders появляются тосты успеха/ошибки
  - визуальная проверка пройдена на превью `http://localhost:3001/`

## 2025-10-23 20:05 (Europe/Warsaw) | UI — Этап 8: Формы унифицированы
- files: `client/src/components/FormField.tsx`, `client/src/pages/Clients.js`, `client/src/pages/Payments.js`, `client/src/pages/Services.js`, `client/src/pages/inventory/Products.js`, `client/src/pages/Orders.js`, `client/src/pages/DetailingOrders.js`, `client/src/pages/settings/Employees.js`, `client/src/pages/settings/Documents.js`
- changes: создан общий враппер `FormField` для подписи, ошибки и подсказки. Использует `FormControl/FormLabel/FormHelperText`, фиксирует высоту зоны подсказки (`minHeight=20`) и единые отступы (`mb=2`), предотвращая «скачки` при появлении ошибок. Диалоги на страницах заменены на `FormField + TextField/Select` с едиными `sx` и без дублирования `InputLabel`. Дополнительно унифицированы диалоги: Orders (быстрый платёж, новый клиент, новый товар), DetailingOrders (создать новый заказ), Настройки → Сотрудники (добавить), Настройки → Документы (создать документ).
- Acceptance:
  - все формы выглядят единообразно (отступы, высоты, подписи)
  - ошибки отображаются под полем, без сдвигов макета
  - Orders: быстрый платёж и новый клиент/товар — ровные отступы и подписи
  - DetailingOrders: диалог создания заказа — Select/DatePicker выровнены, подсказки на месте
  - Настройки: Сотрудники/Документы — диалоги унифицированы; превью `http://localhost:3001/` проверено

## 2025-10-23 19:40 (Europe/Warsaw) | UI — Этап 7: DataGrid унифицирован
- files: `client/src/components/DataGridBase.tsx`, `client/src/pages/Clients.js`, `client/src/pages/Orders.js`, `client/src/pages/DetailingOrders.js`, `client/src/pages/Payments.js`, `client/src/pages/settings/Employees.js`, `client/src/pages/inventory/Suppliers.js`, `client/src/pages/inventory/Products.js`, `client/src/pages/Services.js`, `client/src/pages/inventory/Orders.js`
- changes: создан общий враппер `DataGridBase` с дефолтами: `density='comfortable'`, `disableColumnMenu=true`, `rowHeight=48`, `columnHeaderHeight=56`, `localeText=ruRU`. Во всех перечисленных страницах заменён прямой `DataGrid` на `DataGridBase`; исправлен линтер (свойство шапки — `columnHeaderHeight`), удалены неиспользуемые импорты `DataGrid`.
- Acceptance:
  - таблицы выглядят единообразно, высоты строк/шапки совпадают
  - меню колонок отключено там, где не нужно
  - локализация на русском (`localeText=ruRU`)
  - визуальная проверка пройдена на превью `http://localhost:3001/`

## 2025-10-23 18:25 (Europe/Warsaw) | UI — Этап 5: Пресеты компонентов настроены
- files: `client/src/theme/index.ts`
- changes: добавлены `components.styleOverrides` и `defaultProps` для `MuiButton`, `MuiAppBar`, `MuiDrawer`, `MuiTextField`, `MuiCard`, `MuiTabs`/`MuiTab`, `MuiTable`; настроены состояния `hover/focus/disabled`; поля имеют высоту `48px`, радиусы — из `theme.shape.borderRadius`.
- Acceptance:
  - кнопки, поля, карточки, табы, таблицы выглядят единообразно
  - ховеры/фокусы/disabled применяются предсказуемо
  - визуальная проверка выполнена на превью

## 2025-10-23 18:00 (Europe/Warsaw) | UI — Этап 4: Тема v1 создана
- files: `client/src/theme/index.ts`, `client/src/index.js`
- changes: определена базовая MUI‑тема (palette: primary/secondary/background; typography: Roboto/Helvetica/Arial и `button.textTransform=none`; shape: `borderRadius=8`; spacing: `8`); ThemeProvider переключён на `theme/index.ts`.
- Acceptance:
  - визуально применились цвета и фоны MUI
  - шрифты — Roboto/Helvetica/Arial
  - кнопки без uppercase

## 2025-10-23 17:40 (Europe/Warsaw) | UI — Этап 3: Внедрён AppShell
- files: `client/src/layout/AppShell.tsx`, `client/src/layout/Sidebar.tsx`, `client/src/App.js`
- changes: создан стабильный каркас приложения с `AppBar + Drawer + Content`; Drawer `persistent` на `md+`, `temporary` на `sm-`; ширины/высоты: `drawerWidth=280`, `appBarHeight=64`; контент в `Box` `maxWidth=1440, mx:auto, px:2`; подключены текущее меню и маршруты; отключён mini-режим сайдбара, чтобы исключить «прыжки`.
- Acceptance:
  - хедер и сайдбар единообразны на всех страницах
  - при переходах контент не «прыгает`
  - превью клиента открывается без критических ошибок

## 2025-10-23 17:10 (Europe/Warsaw) | UI — Этап 2: Подключён базовый MUI
- files: `client/src/theme/index.ts`, `client/src/index.js`, `client/src/App.js`, `client/src/theme/index.js`
- changes: создан дефолтный `createTheme({})` и экспорт по умолчанию; приложение обёрнуто в `ThemeProvider` + `CssBaseline` на уровне `index.js`; удалена локальная обёртка в `App.js`; дефолтный экспорт JS‑темы приведён к `createTheme({})` для единообразия
- Acceptance:
  - клиент стартует без ошибок
  - UI отображается с дефолтной темой MUI
  - превью открывается, критических ошибок в консоли нет

## 2025-10-23 16:45 (Europe/Warsaw) | UI — Этап 1: Старое оформление полностью удалено
- files: `client/src/context/ThemeContext.tsx`, `client/src/index.js`, `client/src/index.css`, `client/src/theme.js`
- changes: удалена инъекция глобальных CSS-переменных, отключены overrides, заменён reset на `index.css`, удалён легаси-файл темы
- Acceptance:
  - клиент компилируется без ошибок
  - нет импортов старой темы
  - консоль чистая

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
## 2025-10-24 01:53:01+03:00 | .github/workflows/ci.yml, CHANGELOG_TRAE.md, client/eslint-rules/index.js, client/eslint-rules/no-hardcoded-ui.js, client/eslint.config.cjs, client/package-lock.json, client/package.json, client/src/App.js, client/src/components/DataGridBase.tsx, client/src/components/FormField.tsx, client/src/components/Layout.js, client/src/components/ModalBase.tsx, client/src/components/ModalConfirm.tsx, client/src/components/NotifyProvider.tsx, client/src/components/OrdersTable.js, client/src/context/ThemeContext.tsx, client/src/index.css, client/src/index.js, client/src/layout/AppShell.tsx, client/src/layout/Sidebar.tsx, client/src/pages/Clients.js, client/src/pages/Dashboard.js, client/src/pages/DetailingOrders.js, client/src/pages/Orders.js, client/src/pages/Payments.js, client/src/pages/Services.js, client/src/pages/TaskDetails.js, client/src/pages/TasksBoard.js, client/src/pages/TasksList.js, client/src/pages/inventory/Orders.js, client/src/pages/inventory/Products.js, client/src/pages/inventory/Suppliers.js, client/src/pages/settings/Company.js, client/src/pages/settings/DocumentEditor.js, client/src/pages/settings/Documents.js, client/src/pages/settings/Employees.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/pages/settings/ListSettingsPage.js, client/src/pages/settings/OrderStatuses.js, client/src/pages/settings/OrderTypes.js, client/src/pages/settings/Roles.js, client/src/pages/settings/UiTheme.tsx, client/src/pages/settings/Users.js, client/src/theme.js, client/src/theme/index.js, client/src/theme/index.ts, docs/theme_master_prompt.md, docs/ui-kit.md | feat: migrate UI components to MUI v5 and implement theme system
2025-10-24T02:42:17+03:00 | CHANGELOG_TRAE.md, PHASE3_PLAN.md, TECH_OVERVIEW.md, middleware/auth.js, middleware/validate.js, routes/cash.js, routes/payments.js, scripts/generateSwagger.js, server.js, server/models/CashRegister.js, server/models/Payment.js, storage/docs/TECH_OVERVIEW.md, tests/api.contracts.cash.test.js, tests/e2e/rbac.locations.reports.test.js, tests/payments.rbac.e2e.test.js | feat(payments): add delete endpoint and update RBAC rules
2025-10-24T03:12:07+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/pages/Payments.js, client/src/services/paymentsService.js, routes/payments.js, services/paymentsService.js, storage/docs/TECH_OVERVIEW.md, tests/payments.rules.e2e.test.js | feat(payments): add remove method to payments service and update UI
2025-10-24T11:14:17+03:00 | CHANGELOG_TRAE.md | feat(payments): add remove method to payments service and update UI
2025-10-24T11:14:37+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/layout/AppShell.tsx, client/src/layout/sidebarConfig.ts, middleware/auth.js, scripts/generateSwagger.js, storage/docs/TECH_OVERVIEW.md | feat(rbac): update permissions for payments and cash access
2025-10-24T11:45:00+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, .gitignore, scripts/generateSwagger.js | fix(swagger): enable double-write to artifacts/swagger.json and storage/reports/api-contracts/swagger.json; reuse reportFile; ensure ignore rules

## 2025-10-24 12:05 (Europe/Warsaw) | CI — precontracts before contract tests
- files: `.github/workflows/ci.yml`, `package.json`, `README.md`, `TECH_OVERVIEW.md`
- changes:
  - добавлены npm‑скрипты: `precontracts` (генерация swagger + экстракторы auth/fields/ordertype/payments) и `test:contracts` (последовательный запуск контракт‑тестов после регенерации);
  - обновлён CI workflow: шаг `npm run precontracts` выполняется перед Jest;
  - документация (README/TECH_OVERVIEW) описывает порядок регенерации артефактов перед контракт‑тестами.
- Acceptance:
  - локальный прогон `npm run precontracts` успешно генерирует `artifacts/swagger.json` и артефакты в `storage/reports/api-contracts/`
2025-10-24T14:42:26+03:00 | .env.example, .github/workflows/ci.yml, .gitignore, CHANGELOG_TRAE.md, README.md, TECH_OVERVIEW.md, package.json, routes/orders.js, routes/payments.js, scripts/extractPaymentsSpec.js, scripts/generateSwagger.js, services/configValidator.js, services/paymentsService.js, storage/docs/TECH_OVERVIEW.md, storage/reports/api-contracts/fields.json, storage/reports/api-contracts/ordertype.json, tests/core.flow.e2e.test.js, tests/payments.flags.defaultCash.e2e.test.js, tests/payments.flags.lock.strict.e2e.test.js, tests/payments.flags.refund.e2e.test.js | feat(payments): add ENV flags for refunds, default cash and strict lock
2025-10-25T00:32:04+03:00 | .github/workflows/ci.yml, CHANGELOG_TRAE.md, TECH_OVERVIEW.md, jest.config.js, middleware/validate.js, package.json, routes/items.js, routes/orders.js, routes/stock.js, server/models/Item.js, server/models/StockBalance.js, server/models/StockLedger.js | feat(orders): add dev mode status logs and coverage thresholds
2025-10-25T01:06:17+03:00 | CHANGELOG_TRAE.md, routes/stock.js, server/models/StockLedger.js | feat(stock): add operation type to stock ledger entries
2025-10-24T16:20:00+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, routes/shop.js, server.js, server/models/ShopSale.js, middleware/validate.js, client/src/services/shopSalesService.js, client/src/pages/shop/SaleForm.js, client/src/pages/shop/ShopHistory.js, client/src/App.js, client/src/layout/sidebarConfig.ts | feat(shop): scaffold shop sales API, model, client UI and routing
2025-10-25T19:23:32+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/App.js, client/src/layout/sidebarConfig.ts, client/src/pages/Settings.js, client/src/pages/reports/Payroll.js, client/src/pages/reports/StockTurnover.js, client/src/pages/settings/PayrollRules.js, client/src/pages/shop/SaleForm.js, client/src/pages/shop/ShopHistory.js, client/src/services/payrollService.js, client/src/services/reportsService.js, client/src/services/shopSalesService.js, jest.config.js, middleware/validate.js, package.json, routes/employees.js, routes/payrollAccruals.js, routes/payrollRules.js, routes/reports.js, routes/shop.js, scripts/extractItemsSpec.js, scripts/extractPayrollSpec.js, scripts/extractShopSalesSpec.js, scripts/generateSwagger.js, server.js, server/models/Employee.js, server/models/PayrollAccrual.js, server/models/PayrollRule.js, server/models/ShopSale.js, services/telegramNotify.js, storage/reports/api-contracts/fields.json, tests/e2e/items.e2e.test.js, tests/e2e/payroll.summary.e2e.test.js, tests/e2e/shop.sales.e2e.test.js | feat(payroll): add payroll rules, accruals, reports and UI components

## 2025-10-25 20:00 (Europe/Warsaw) | Docs — Jest coverage thresholds synced (65/65/50/55)
- files: `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- changes: обновлён раздел Tests/Thresholds в TECH_OVERVIEW.md на пороги `65/65/50/55`; добавлена текущая запись в changelog; подтверждена согласованность значений с `jest.config.js` и CI‑шагом «Coverage gates (Jest)».
- Acceptance:
  - TECH_OVERVIEW.md отражает пороги 65/65/50/55.
  - `jest.config.js` содержит `coverageThreshold` с теми же значениями.
  - В CI шаг «Coverage gates (Jest)» запускает `npm run test:cov` и гейт проходит при достижении порогов.

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
2025-10-24T01:53:01+03:00 | .github/workflows/ci.yml, CHANGELOG_TRAE.md, client/eslint-rules/index.js, client/eslint-rules/no-hardcoded-ui.js, client/eslint.config.cjs, client/package-lock.json, client/package.json, client/src/App.js, client/src/components/DataGridBase.tsx, client/src/components/FormField.tsx, client/src/components/Layout.js, client/src/components/ModalBase.tsx, client/src/components/ModalConfirm.tsx, client/src/components/NotifyProvider.tsx, client/src/components/OrdersTable.js, client/src/context/ThemeContext.tsx, client/src/index.css, client/src/index.js, client/src/layout/AppShell.tsx, client/src/layout/Sidebar.tsx, client/src/pages/Clients.js, client/src/pages/Dashboard.js, client/src/pages/DetailingOrders.js, client/src/pages/Orders.js, client/src/pages/Payments.js, client/src/pages/Services.js, client/src/pages/TaskDetails.js, client/src/pages/TasksBoard.js, client/src/pages/TasksList.js, client/src/pages/inventory/Orders.js, client/src/pages/inventory/Products.js, client/src/pages/inventory/Suppliers.js, client/src/pages/settings/Company.js, client/src/pages/settings/DocumentEditor.js, client/src/pages/settings/Documents.js, client/src/pages/settings/Employees.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/pages/settings/ListSettingsPage.js, client/src/pages/settings/OrderStatuses.js, client/src/pages/settings/OrderTypes.js, client/src/pages/settings/Roles.js, client/src/pages/settings/UiTheme.tsx, client/src/pages/settings/Users.js, client/src/theme.js, client/src/theme/index.js, client/src/theme/index.ts, docs/theme_master_prompt.md, docs/ui-kit.md | feat: migrate UI components to MUI v5 and implement theme system
2025-10-24T02:42:17+03:00 | CHANGELOG_TRAE.md, PHASE3_PLAN.md, TECH_OVERVIEW.md, middleware/auth.js, middleware/validate.js, routes/cash.js, routes/payments.js, scripts/generateSwagger.js, server.js, server/models/CashRegister.js, server/models/Payment.js, storage/docs/TECH_OVERVIEW.md, tests/api.contracts.cash.test.js, tests/e2e/rbac.locations.reports.test.js, tests/payments.rbac.e2e.test.js | feat(payments): add delete endpoint and update RBAC rules
2025-10-24T03:12:07+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/pages/Payments.js, client/src/services/paymentsService.js, routes/payments.js, services/paymentsService.js, storage/docs/TECH_OVERVIEW.md, tests/payments.rules.e2e.test.js | feat(payments): add remove method to payments service and update UI
2025-10-24T11:14:17+03:00 | CHANGELOG_TRAE.md | feat(payments): add remove method to payments service and update UI
2025-10-24T11:14:37+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/layout/AppShell.tsx, client/src/layout/sidebarConfig.ts, middleware/auth.js, scripts/generateSwagger.js, storage/docs/TECH_OVERVIEW.md | feat(rbac): update permissions for payments and cash access
2025-10-24T11:45:00+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, .gitignore, scripts/generateSwagger.js | fix(swagger): enable double-write to artifacts/swagger.json and storage/reports/api-contracts/swagger.json; reuse reportFile; ensure ignore rules

## 2025-10-24 12:05 (Europe/Warsaw) | CI — precontracts before contract tests
- files: `.github/workflows/ci.yml`, `package.json`, `README.md`, `TECH_OVERVIEW.md`
- changes:
  - добавлены npm‑скрипты: `precontracts` (генерация swagger + экстракторы auth/fields/ordertype/payments) и `test:contracts` (последовательный запуск контракт‑тестов после регенерации);
  - обновлён CI workflow: шаг `npm run precontracts` выполняется перед Jest;
  - документация (README/TECH_OVERVIEW) описывает порядок регенерации артефактов перед контракт‑тестами.
- Acceptance:
  - локальный прогон `npm run precontracts` успешно генерирует `artifacts/swagger.json` и артефакты в `storage/reports/api-contracts/`
2025-10-24T14:42:26+03:00 | .env.example, .github/workflows/ci.yml, .gitignore, CHANGELOG_TRAE.md, README.md, TECH_OVERVIEW.md, package.json, routes/orders.js, routes/payments.js, scripts/extractPaymentsSpec.js, scripts/generateSwagger.js, services/configValidator.js, services/paymentsService.js, storage/docs/TECH_OVERVIEW.md, storage/reports/api-contracts/fields.json, storage/reports/api-contracts/ordertype.json, tests/core.flow.e2e.test.js, tests/payments.flags.defaultCash.e2e.test.js, tests/payments.flags.lock.strict.e2e.test.js, tests/payments.flags.refund.e2e.test.js | feat(payments): add ENV flags for refunds, default cash and strict lock
2025-10-25T00:32:04+03:00 | .github/workflows/ci.yml, CHANGELOG_TRAE.md, TECH_OVERVIEW.md, jest.config.js, middleware/validate.js, package.json, routes/items.js, routes/orders.js, routes/stock.js, server/models/Item.js, server/models/StockBalance.js, server/models/StockLedger.js | feat(orders): add dev mode status logs and coverage thresholds
2025-10-25T01:06:17+03:00 | CHANGELOG_TRAE.md, routes/stock.js, server/models/StockLedger.js | feat(stock): add operation type to stock ledger entries
2025-10-24T16:20:00+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, routes/shop.js, server.js, server/models/ShopSale.js, middleware/validate.js, client/src/services/shopSalesService.js, client/src/pages/shop/SaleForm.js, client/src/pages/shop/ShopHistory.js, client/src/App.js, client/src/layout/sidebarConfig.ts | feat(shop): scaffold shop sales API, model, client UI and routing
2025-10-25T19:23:32+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/App.js, client/src/layout/sidebarConfig.ts, client/src/pages/Settings.js, client/src/pages/reports/Payroll.js, client/src/pages/reports/StockTurnover.js, client/src/pages/settings/PayrollRules.js, client/src/pages/shop/SaleForm.js, client/src/pages/shop/ShopHistory.js, client/src/services/payrollService.js, client/src/services/reportsService.js, client/src/services/shopSalesService.js, jest.config.js, middleware/validate.js, package.json, routes/employees.js, routes/payrollAccruals.js, routes/payrollRules.js, routes/reports.js, routes/shop.js, scripts/extractItemsSpec.js, scripts/extractPayrollSpec.js, scripts/extractShopSalesSpec.js, scripts/generateSwagger.js, server.js, server/models/Employee.js, server/models/PayrollAccrual.js, server/models/PayrollRule.js, server/models/ShopSale.js, services/telegramNotify.js, storage/reports/api-contracts/fields.json, tests/e2e/items.e2e.test.js, tests/e2e/payroll.summary.e2e.test.js, tests/e2e/shop.sales.e2e.test.js | feat(payroll): add payroll rules, accruals, reports and UI components
2025-10-25T22:00:16+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/App.js, client/src/pages/Landing.js, client/src/pages/OnboardingChecklist.js, client/src/pages/OnboardingWizard.js, client/src/pages/Payments.js, client/src/pages/reports/Payroll.js, client/src/pages/shop/SaleForm.js, client/src/pages/shop/ShopHistory.js, client/src/theme/index.ts, client/src/theme/theme.ts, routes/public.js | feat(onboarding): implement onboarding wizard, checklist and landing page
2025-10-25T23:55:53+03:00 | CHANGELOG_TRAE.md, README.md | docs: update readme with test coverage command and thresholds
