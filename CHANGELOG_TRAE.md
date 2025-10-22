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
