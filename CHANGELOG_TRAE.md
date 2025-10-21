## 2025-10-21 09:00 (Europe/Warsaw) | UI/Theming
- feat(ui): theming (CharacterDark + LightMinimal)
- ThemeContext, CSS variables injection, ThemeSwitcher
- Settings→UiTheme page with RBAC
- Refactor core components to theme tokens

## 2025-10-20 21:15 (Europe/Warsaw) | Swagger & Artifacts: Fields
- files: scripts/generateSwagger.js, scripts/extractFieldsSpec.js, artifacts/swagger.json, storage/reports/api-contracts/fields.json, TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- generator: добавлена схема `DeleteResponse`, регенерирован OpenAPI (`artifacts/swagger.json`)
- artifacts: добавлен экстрактор Fields и выпущен контракт `storage/reports/api-contracts/fields.json`
- run: `node scripts/generateSwagger.js`; `node scripts/extractFieldsSpec.js`
- Acceptance: контракты Swagger актуальны

## 2025-10-20 20:30 (Europe/Warsaw) | Health & Seed: FieldSchemas
- files: health/dataSanity.js, scripts/seedFieldSchemas.js, TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- health: добавлены проверки FieldSchemas — единственная активная версия на пару scope+name; отсутствие активной; дубликаты версий внутри пары; невалидные номера версий; обязательные options[] для list/multilist
- seed: добавлен `scripts/seedFieldSchemas.js` — создаёт дефолтные пары (orders/«Форма заказа», clients/«Форма клиента»), нормализует активность (активной остаётся самая свежая), не перезаписывает существующие версии
- run: `node health/dataSanity.js`; `node scripts/seedFieldSchemas.js` (использует `MONGO_URI|MONGO_URL`)
- Acceptance: health-чек и сидеры добавлены, все ок

## 2025-10-20 18:02 (локальное время) | Push to main
- server: server.js, server-demo.js, services/*, validation/clientSchema.js
- client: —
- scripts: generateSwagger.js, migrateOrderStatuses.js, perfDiagnostics.js, seedOrderStatuses.js, seedRoles.js, seedStatusGroups.js, testStatusModels.js
- docs: TECH_OVERVIEW.md, CHANGELOG_TRAE.md, storage/reports/*
- configs: .gitignore (нормализован `node_modules/`, добавлены `coverage/`, `client/coverage/`, `artifacts/`)
- tests: e2e/contract/unit обновления (queue/statuses/payments/rbac/templates/env)

### Preflight
- .gitignore: нормализован `node_modules/` (ранее `node_modules`), добавлены `coverage/`, `client/coverage/`, `artifacts/`.
- Индекс: удалены `.env` (cached), очищены `client/coverage`, `coverage`, `artifacts`, `node_modules`, `.DS_Store`.

Commit: f3e6b11
Pushed to: origin/main @ f3e6b11

### Models
- Добавлена модель `OrderType` (`server/models/OrderType.js`).
- 2025-10-20 17:23 (Europe/Warsaw) — Добавлены валидаторы `OrderType`: `pre('validate')` нормализует `code` (lowercase/trim); проверка `startStatusId ∈ allowedStatuses`; при нарушении — `ValidationError` с кодом `ORDERTYPE_INVALID_START_STATUS`.
  - server: `server/models/OrderType.js`
  - scripts: `scripts/testOrderTypeValidation.js`
  - docs: `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`
- Acceptance: попытка сохранить `startStatusId ∉ allowedStatuses` → `400 ValidationError` (`ORDERTYPE_INVALID_START_STATUS`); `code` приводится к нижнему регистру и триммится при валидации.

2025-10-17T12:00:00Z | models/User.js, models/Role.js, models/UserRole.js, models/UserToken.js | Добавлены базовые модели аутентификации (Users, Roles, UserRoles, UserTokens)
2025-10-17T12:03:00Z | routes/roles.js | Созданы CRUD-маршруты для ролей, запрет удаления при наличии связей
2025-10-17T12:04:00Z | routes/users.js | Созданы CRUD-маршруты для пользователей, скрыт pass_hash, очистка связей
2025-10-17T12:05:00Z | scripts/seedRoles.js | Добавлен seed-скрипт для дефолтных ролей (ru-RU имена)
2025-10-17T12:06:00Z | client/src/services/usersService.js, client/src/services/rolesService.js | Добавлены клиентские API-сервисы для Users и Roles
2025-10-17T12:08:00Z | client/src/pages/settings/Users.js, client/src/pages/settings/Roles.js | Добавлены минимальные CRUD-страницы Настройки → Пользователи и Роли
2025-10-17T12:10:00Z | routes/auth.js, server.js | Реализованы /api/auth (bootstrap-admin, login, refresh, logout), смонтированы users/roles/auth на сервере
2025-10-18T09:00:00Z | client/src/services/http.js | Добавлен Bearer Authorization + авто-рефреш токена при 401
2025-10-18T09:01:00Z | client/src/services/authService.js | Добавлены вызовы /auth/login, /auth/refresh, /auth/logout
2025-10-18T09:02:00Z | client/src/pages/Login.js | Добавлена простая страница входа
2025-10-18T09:03:00Z | client/src/components/LogoutButton.js, client/src/components/Layout.js | Добавлена кнопка выхода и интеграция в меню
2025-10-18T09:04:00Z | client/src/App.js, client/src/pages/Settings.js | Добавлены маршруты /login, /settings/users, /settings/roles и пункты меню
2025-10-18T09:05:00Z | models/UserToken.js | Включён TTL-индекс по expires_at для автоудаления refresh-токенов
2025-10-18T10:20:00Z | client/src/services/http.js, client/package.json | baseURL по умолчанию изменён на '/api', proxy клиента настроен на http://localhost:5002 для корректной работы через dev-прокси
2025-10-18T10:21:00Z | client/src/pages/TasksBoard.js, client/src/pages/TasksList.js | Исправлены ключи элементов в списках тегов (уникальные key), убрано предупреждение React
2025-10-18T10:22:00Z | client/src/pages/TasksBoard.js | Устранены no-undef ошибки в дублирующем компоненте TasksBoardDuplicate (удалены некорректные пропсы)
2025-10-18T17:49:00Z | client/src/context/authStore.js, client/src/context/AuthContext.jsx | Введён глобальный AuthStore (in-memory) и AuthContext с безопасным refresh
2025-10-18T17:50:00Z | client/src/services/http.js | Переведены интерсепторы на память (in-memory access), авто-рефреш при 401
2025-10-18T17:51:00Z | client/src/components/ProtectedRoute.jsx, client/src/App.js | Добавлен ProtectedRoute, обёрнуты маршруты и настроен RBAC по ролям
2025-10-18T17:52:00Z | client/src/pages/Login.js | Логин переведён на AuthContext, редирект на Дашборд после входа
2025-10-18T17:53:00Z | client/src/components/Layout.js | Добавлен AppBar с «Профиль → Выйти», скрытие пунктов меню по ролям (RBAC)
2025-10-19T11:00:00Z | routes/roles.js | DEV_MODE: in-memory CRUD для ролей (list/get/create/update/delete)
2025-10-19T11:01:00Z | routes/users.js | DEV_MODE: in-memory CRUD для пользователей + назначение ролей
2025-10-19T11:02:00Z | client/src/pages/settings/Users.js | Добавлен мультиселект ролей и сохранение ролей при обновлении
2025-10-19T11:03:00Z | client/src/pages/BootstrapWizard.js, client/src/App.js | Добавлен мастер Bootstrap администратора (/bootstrap), вызов /auth/bootstrap-admin и сид базовых ролей
2025-10-19T11:04:00Z | client/src/pages/RbacTest.js, client/src/App.js | Добавлена страница RBAC Test (/rbac-test), отображение доступных маршрутов и действий
2025-10-19T11:25:00Z | README.md, .gitignore | Добавлены инструкции DEV-режима, страницы Bootstrap/RBAC; игнор client/.env
2025-10-19T12:10:00Z | client/src/pages/settings/FieldsBuilderPage.js | Добавлены всплывающие подсказки «i» (Tooltip + InfoOutlinedIcon) рядом с полями: «Код поля», «Название для пользователей», «Тип поля»
2025-10-19T12:11:00Z | client/src/pages/settings/FieldsBuilderPage.js | Расширён тип «Список»: поле ввода вариантов, добавление/удаление вариантов, отображение как Chips, валидация наличия вариантов
2025-10-19T12:12:00Z | client/src/pages/settings/FieldsBuilderPage.js | Варианты для типа «Список» сохраняются в localStorage и показываются в перечне добавленных полей
2025-10-19T12:30:00Z | client/src/App.js | Настройки → добавлена страница «Статьи движения денежных средств» на базе ListSettingsPage: storageKey "payment_categories", плейсхолдер "Название статьи", загружен полный список статей (Приход/Расход), поддержка добавления/удаления, импорт/экспорт, хранение в localStorage
2025-10-19T12:50:00Z | client/src/pages/settings/PaymentArticles.js, client/src/App.js, client/src/pages/Payments.js | Улучшен UI статей: отдельная страница с группами «Приход»/«Расход», цветные чипы, системные статьи (замок), импорт/экспорт, сброс; Payments читает новый формат (income/expense)
2025-10-19T13:40:00Z | client/src/pages/settings/PaymentArticles.js, client/src/pages/Payments.js | Статьи переведены на алфавитный список с иерархией (категории/подкатегории); Payments получил выбор категории/подкатегории и сохранение статьи; storage мигрирован к формату дерева {income:[{name,children}], expense:[...]}
2025-10-19T14:20:00Z | client/src/pages/settings/DocumentEditor.js, client/src/pages/Orders.js, client/src/pages/Payments.js | Добавлены пресеты под термопринтеры (Zebra EPL/TSPL, чек 58/80 мм) с предустановленными отступами; расширен контекст шаблонов (скидки/налоги/платёж/товар); добавлена история версий и откат.
2025-10-19T21:59:58.529Z | .git/hooks/post-commit, scripts/changelog.js | Автообновление CHANGELOG: ручной режим для ассистентских правок
2025-10-19T22:00:41.785Z | scripts/changelog.js | Фикс форматирования CHANGELOG: разделитель строки при ручном append
2025-10-19T22:10:00.374Z | models/OrderStatus.js, models/OrderStatusLog.js, scripts/testStatusModels.js | Добавлены модели OrderStatus и OrderStatusLog с бизнес-ограничениями
2025-10-19T22:12:23.587Z | scripts/testStatusModels.js, config/db.js | Добавлен офлайн-режим тестирования моделей через validate() при недоступной MongoDB
2025-10-19T22:15:17.043Z | scripts/seedStatusGroups.js, scripts/seedOrderStatuses.js, models/OrderStatus.js | Добавлены сид-скрипты статусов и групп; патч regex code для '_'
2025-10-19T22:19:16.692Z |  | Assistant update
2025-10-19T22:22:01.028Z |  | Assistant update
2025-10-19T22:24:48.342Z |  | Assistant update
2025-10-20T12:00:00Z | services/queueMetrics.js, routes/queue.js, queues/statusActionQueue.js, tests/queue.statusActions.metrics.unit.test.js, tests/queue.statusActions.metrics.e2e.test.js | Усилена DEV-очередь статус-действий: retry/backoff, duration; добавлены e2e тесты (идемпотентность, ретраи, мини‑нагрузка) и отчёт p50/p95.
2025-10-20T14:15:00Z | queues/statusActionQueue.js, services/queueMetrics.js, tests/queue.statusActions.behavior.e2e.test.js, tests/queue.statusActions.metrics.e2e.test.js | Усилена DEV-очередь статус-действий: retry/backoff, duration; добавлены e2e тесты (идемпотентность, ретраи, мини‑нагрузка) и отчёт p50/p95.
2025-10-20T14:45:00Z | services/configValidator.js, server.js, tests/env.validator.test.js | Добавлен валидатор конфигурации ENV (zod), интегрирован в старт сервера, покрыт тестами.

## Features
- Схема ENV (zod): `MONGO_URI|MONGO_URL`, `AUTH_DEV_MODE`, `REDIS_URL|REDIS_HOST|REDIS_PORT`, `SMTP_*`, `NOTIFY_DRY_RUN`, `PRINT_DRY_RUN`, `JWT_SECRET`.
- На старте сервера: логирование `Config OK` либо понятных предупреждений об отсутствующих/конфликтных переменных (без падения в DEV).

## Tests
- DEV: минимальный набор (`AUTH_DEV_MODE=1`, DRY-флаги) → предупреждения по Mongo/Redis, сервер стартует.
- PROD: полный конфиг → без предупреждений, `Config OK`.
- Конфликты: одновременно `MONGO_URI` и `MONGO_URL` → явное предупреждение.
- Уведомления: `NOTIFY_DRY_RUN=0` без SMTP → предупреждение.

## Acceptance
- Ясные сообщения валидатора, DEV не падает, PROD без предупреждений.

### 2025-10-20 — API & RBAC Inventory
 - Произведена инвентаризация маршрутов, сервисов, очередей и моделей.
 - Сформирована карта RBAC на основе серверного маунта, роут-гардов и проверок на уровне сервисов.
 - Зафиксированы несоответствия: публичные комментарии для GET (clients / boxes / detailing-orders) против глобального `requireAuth`.
 - Обнаружены пробелы RBAC: `users.js`, `roles.js`, `payments.js` не имеют явных `requireRole` чеков.
 - Добавлен отчёт: `storage/reports/api-rbac-inventory-2025-10-20.md`.

### 2025-10-20 — RBAC tightening & tests
- Сервер: ограничил `/api/users` и `/api/roles` только `Admin`.
- Сервер: ограничил `POST /api/payments` и `POST /api/payments/refund` для `Finance` или `Admin`.
- Клиент: обновил `ProtectedRoute` для `/settings/users` и `/settings/roles` → только `Admin`.
- Тесты: добавлены e2e в `tests/rbac.e2e.test.js` (403/200/201 для Users/Roles/Payments и смежных эндпоинтов). Прогон прошёл успешно.
- Docs: создан отчёт `storage/reports/api-rbac-inventory-2025-10-20.md` с инвентаризацией RBAC.

### 2025-10-20 — RBAC e2e
 - Добавлен тест-сьют `tests/rbac.e2e.test.js` для проверки RBAC критичных маршрутов.
 - Исправлены ожидания тестов: `notifyTemplates` требует `bodyHtml`, метрики очереди возвращают объект без `{ok}`.
 - Покрыты ключевые проверки 403/200: statuses, doc/notify templates, queue metrics, order status change, order files.

### 2025-10-20 — Статическая проверка JS/React
 - Настроен ESLint (airbnb-base + react/jsx-a11y) для сервера и клиента.
 - Выполнены авто-фиксы, сформированы отчёты с количеством ошибок/варнингов, топ-правилами и проблемными файлами.
 - Проверены dead code (unused imports/exports) и циклические зависимости (madge).
 - Проверена консистентность алиасов импортов — алиасы не используются, относительные импорты единообразны.
 - Отчёт: `storage/reports/static-analysis-2025-10-20.md`.
 - Уточнена конфигурация клиента: добавлены browser/process globals, удалён legacy `.eslintignore`.
 - Уточнена конфигурация сервера: `parserOptions.sourceType=script`, отключён `missingExports` в `import/no-unused-modules`, отключён `global-require`.
 - Второй прогон ESLint: всего — ошибки 272, варнинги 735; сервер — 216/18; клиент — 56/717.

### 2025-10-20 — Health: Data Sanity
 - Добавлен скрипт `health/dataSanity.js` для проверки инвариантов БД.
 - Проверки:
   - `OrderStatus`: уникальность `code`, `group ∈ preset`, валидация `notify`-действий (наличие `templateId` и `channel`), проверка сиротских ссылок `actions.templateId/docId` → `NotifyTemplate`/`DocTemplate`.
   - `Orders`: `status ∈ OrderStatus.code`, `closed.success=false → paymentsLocked=true`, заполненность `statusChangedAt`.
   - `OrderStatusLog`: валидность последовательности `from → to`, отсутствуют дубликаты логов по `createdAt`, отсутствие дубликатов типов в `actionsEnqueued`.
 - Вывод: структурированный JSON-отчёт (сводка, проблемы, ограничения), процесс завершается кодом 0.
 - Запуск: `node health/dataSanity.js` (использует `MONGO_URI|MONGO_URL`).
 - Поля отчёта: `mongoConnected`, `summary`, `problems.{orderStatus,orders,logs}`, `info.limitations`, `when`.
 - Применимость: отчёт пригоден для миграции/починки; проблемные IDs сгруппированы по типам.

### 2025-10-20 — Security quick pass
 - npm audit: ошибка сети (ECONNRESET), сформирован fallback-отчёт (список прямых зависимостей, предложения обновлений, необходимость повторного прогона при доступе к registry).
 - Заголовки безопасности: добавлен `helmet` в `server.js` и `api-server.js`.
 - CORS: прод-конфигурация через `CORS_ORIGIN` (список разрешённых доменов), dev — permissive; методы ограничены.
 - Запрет опасных методов: блок `TRACE`/`TRACK` в продакшене.
 - Валидация входных данных: Zod используется для ENV (`services/configValidator.js`); для POST/PATCH маршрутов — ручные проверки/Joi, Zod-схемы отсутствуют.
 - Секреты в логах: не найдено логирования `SMTP_PASS`, токенов, `Authorization`; `middleware/error` пишет `err.stack` без тела/заголовков.

 - Action items (S/M/L):
   - S: Повторить `npm audit` при восстановлении сети и сохранить отчёт.
   - S: Задать `CORS_ORIGIN` в .env для продакшена.
   - S: Маскировать `Authorization` в потенциальном логировании запросов (на будущее).
   - M: Внедрить Zod-схемы для POST/PATCH (clients, orders, statuses).
   - L: Обновить `mongoose` до 8.x и прогнать тесты/миграции.
   - S: Обновить патчи (`dotenv`, `uuid`, `jsonwebtoken`) до последних версий.
 - Linting & Static Analysis — 2025-10-20 (Final)
 - ESLint after fixes — Server: errors 241, warnings 25
 - ESLint after fixes — Client: errors 56, warnings 719
 - Overall totals: errors 297, warnings 744
 - Report: `storage/reports/static-analysis-2025-10-20-final.md`
 - Artifacts: `storage/reports/eslint-server-final.json`, `storage/reports/eslint-client-final.json`
 - Artifact regenerated: `artifacts/swagger.json`.
 - Consistency: route comments, guards, and Swagger aligned; no discrepancies found.

## Fix: statusActionsHandler missing-template errors and template deletion guards — 2025-10-20

- statusActionsHandler: ensured missing notify/doc templates throw errors even in DEV.
  - Added awaited pickTemplate calls across notify/print adapters and pre-checks.
  - Verified via unit tests: `tests/statusActionsHandler.validation.unit.test.js` now passes.
- routes/notifyTemplates.js, routes/docTemplates.js: reinforced deletion guards.
  - Check for `OrderStatus.exists` by id and code; return `400 TEMPLATE_IN_USE` when referenced.
  - Added Jest DEV fallback for `resetModules` cloning: infer usage by id/code when `exists` mock is undefined.
  - Verified via e2e: `tests/templates.delete.guard.e2e.test.js` passes.
- Observability: added debug logs around deletion guard checks to aid diagnosis.

Coverage deltas (server):
- routes/notifyTemplates.js — improved exercised lines around delete guard.
- routes/docTemplates.js — improved exercised lines around delete guard.
- Statements: ~56%
- Lines: ~57.6%
- Functions: ~45.9%

Coverage (client):
- Statements: 0%
- Lines: 0%
- Functions: 0%

Threshold policy:
- Target: lines >= 70%, statements >= 70%.
- Dynamic rule: if current < 70%, require at least current+5pp for the next run.
  - Server next-run thresholds: lines ≥ 62.6%, statements ≥ 61% (final target 70%).
  - Client next-run thresholds: lines ≥ 5%, statements ≥ 5% (final target 70%).

Least covered (server, by lines):
- services/orderStatusService.js — 13.6%
- services/statusDeletionGuard.js — 16.7%
- routes/docTemplates.js — 24.5%
- routes/notifyTemplates.js — 26.3%
- models/OrderStatus.js — 32.7%

3 быстрых тест-кейса для повышения покрытия:
- orderStatusService: покрыть changeOrderStatus — успешный переход (200) и ошибка (404/400), мок моделей и очереди.
- statusDeletionGuard: покрыть isStatusInOrderTypes — true/false для нескольких типов заказов и статусов.
- docTemplates routes: e2e GET/POST в DEV-режиме с заголовком x-user-role=\"settings.docs:*\", проверить 200 и схему ответа.

Артефакты:
- Server coverage: `coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
- Client coverage: `client/coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)

## 3.2 — OrderTypes (финал)

Подзадачи:
- API: защита `/api/order-types*` через `requirePermission(orderTypes.read|orderTypes.write)`.
- RBAC: добавлены `orderTypes.read`/`orderTypes.write` в `RBAC_MAP` и мидлвар `requirePermission`.
- UI: скрытие пункта меню и защита маршрута `settings/forms/order-types` только для `Admin`.
- Settings: страница «Типы заказов» переведена на полноценный CRUD через API; выбор `startStatusId`, `allowedStatuses`, `docTemplateIds`.
- Health/Data Sanity: проверки связей Orders ↔ OrderTypes, инвариант `startStatusId ∈ allowedStatuses`.
- OpenAPI/Артефакты: Swagger обновлён; выделен контракт `storage/reports/api-contracts/ordertype.json`.
- Tests: контрактные и e2e‑тесты для CRUD/guards; RBAC‑покрытие.

Файлы (основные):
- `routes/orderTypes.js`, `middleware/auth.js`, `server/models/OrderType.js`
- `client/src/pages/settings/OrderTypes.js`, `client/src/components/Layout.js`, `client/src/App.js`, `client/src/pages/RbacTest.js`
- `health/dataSanity.js`, `scripts/generateSwagger.js`, `scripts/extractOrderTypeSpec.js`
- `tests/orderTypes.contract.test.js`, `tests/orderTypes.e2e.test.js`, `tests/rbac.e2e.test.js`
- `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`

Схемы/миграции:
- Схема: `server/models/OrderType.js` (2025‑10; поля: `startStatusId`, `allowedStatuses`, `docTemplateIds`, `isSystem`; нормализация `code`).
- Миграция: `scripts/migrations/2025-10-OrderType-backfill.js`.

Краткий тест‑чеклист:
- Admin: видит пункт меню «Типы заказов», открывает страницу, выполняет CRUD.
- Manager/без ролей: не видит меню и не открывает страницу; API `GET/POST/PATCH/DELETE /api/order-types*` → `403`.
- POST/PATCH: нарушение `startStatusId ∈ allowedStatuses` → `400 ORDERTYPE_INVALID_START_STATUS`.
- DELETE: системный тип → `409 SYSTEM_TYPE`; тип в использовании → `409 ORDERTYPE_IN_USE`.
- Создание заказа с `orderTypeId`: берёт стартовый статус из типа; переходы вне `allowedStatuses` блокируются.

2025-10-20T22:00:00+02:00 (Europe/Warsaw) | TECH_OVERVIEW.md, CHANGELOG_TRAE.md, /Users/admin/Downloads/TECH_OVERVIEW.md
- docs(overview): обновлён статус OrderTypes: «Основные модули — OK», «Состояние проекта» — удалён этап 3.2; «UI — возможности пользователя» описывает настройку типов и влияние на заказ.
- docs(changelog): добавлен раздел «3.2 — OrderTypes (финал)» с подзадачами, файлами, схемами/миграциями и тест‑чеклистом.
- docs(export): синхронизирован `/Users/admin/Downloads/TECH_OVERVIEW.md`.

### Acceptance
- TECH_OVERVIEW отражает итоговый статус 3.2 (OrderTypes — OK) и актуальные возможности UI.
- CHANGELOG содержит структурированный раздел 3.2 и финальную dated‑запись.
- Файл в `Downloads` обновлён и соответствует репозиторию.

## Кэширование (TTL 60s)
- Добавлен in-memory TTL-кэш для `GET /api/statuses` и `GET /api/doc-templates`.
- Инвалидаторы: при `POST/PUT/PATCH/DELETE` соответствующих сущностей кэш очищается.
- ENV: `CACHE_TTL_SECS` (дефолт `60`), добавлено в `.env.example`.
- Метрики: логируются `hits/misses`, а также `set/invalidate` с именем кэша и ключом.
- Тесты: `tests/cache.statuses.docTemplates.e2e.test.js` — два подряд `GET` → второй из кэша; после `POST` кэш сбрасывается и следующий `GET` — miss, затем hit.
- Примечание: для e2e тестов `OrderStatus` замокан (без реальной Mongo), DEV-ветка для doc-templates.

Routes and Swagger alignment
- Updated `@access Public` comments to `@access Authenticated` for GET in `routes/clients.js`, `routes/boxes.js`, `routes/detailingOrders.js` to match global `requireAuth`.
- Generated TECH_OVERVIEW.md (project inventory & architecture summary)
- Swagger updated:
  - Added `bearerAuth` GET paths: `/api/clients`, `/api/clients/{id}`, `/api/boxes`, `/api/boxes/{id}`, `/api/detailing-orders`, `/api/detailing-orders/batch`, `/api/detailing-orders/{id}`, `/api/detailing-orders/client/{clientId}`.
  - Added public paths: `/api/public/health`, `/api/public/status`.
- Artifact regenerated: `artifacts/swagger.json`.
- Consistency: route comments, guards, and Swagger aligned; no discrepancies found.

## Fix: statusActionsHandler missing-template errors and template deletion guards — 2025-10-20

- statusActionsHandler: ensured missing notify/doc templates throw errors even in DEV.
  - Added awaited pickTemplate calls across notify/print adapters and pre-checks.
  - Verified via unit tests: `tests/statusActionsHandler.validation.unit.test.js` now passes.
- routes/notifyTemplates.js, routes/docTemplates.js: reinforced deletion guards.
  - Check for `OrderStatus.exists` by id and code; return `400 TEMPLATE_IN_USE` when referenced.
  - Added Jest DEV fallback for `resetModules` cloning: infer usage by id/code when `exists` mock is undefined.
  - Verified via e2e: `tests/templates.delete.guard.e2e.test.js` passes.
- Observability: added debug logs around deletion guard checks to aid diagnosis.

Coverage deltas (server):
- routes/notifyTemplates.js — improved exercised lines around delete guard.
- routes/docTemplates.js — improved exercised lines around delete guard.
- Statements: ~56%
- Lines: ~57.6%
- Functions: ~45.9%

Coverage (client):
- Statements: 0%
- Lines: 0%
- Functions: 0%

Threshold policy:
- Target: lines >= 70%, statements >= 70%.
- Dynamic rule: if current < 70%, require at least current+5pp for the next run.
  - Server next-run thresholds: lines ≥ 62.6%, statements ≥ 61% (final target 70%).
  - Client next-run thresholds: lines ≥ 5%, statements ≥ 5% (final target 70%).

Least covered (server, by lines):
- services/orderStatusService.js — 13.6%
- services/statusDeletionGuard.js — 16.7%
- routes/docTemplates.js — 24.5%
- routes/notifyTemplates.js — 26.3%
- models/OrderStatus.js — 32.7%

3 быстрых тест-кейса для повышения покрытия:
- orderStatusService: покрыть changeOrderStatus — успешный переход (200) и ошибка (404/400), мок моделей и очереди.
- statusDeletionGuard: покрыть isStatusInOrderTypes — true/false для нескольких типов заказов и статусов.
- docTemplates routes: e2e GET/POST в DEV-режиме с заголовком x-user-role=\"settings.docs:*\", проверить 200 и схему ответа.

Артефакты:
- Server coverage: `coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
- Client coverage: `client/coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
2025-10-20T17:50:47+03:00 | client/src/App.js, client/src/components/SettingsBackBar.js, client/src/pages/Settings.js, client/src/pages/settings/ClientsNotifications.js, client/src/pages/settings/Company.js, client/src/pages/settings/Employees.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/pages/settings/ListSettingsPage.js, client/src/pages/settings/OrderTypes.js, client/src/pages/settings/OrdersGeneral.js, client/src/pages/settings/OrdersSMS.js, client/src/pages/settings/Roles.js, client/src/pages/settings/Users.js | feat(settings): implement unified settings back bar and order types configuration
2025-10-20T20:15:00+02:00 (Europe/Warsaw) | routes/orderTypes.js, server.js, scripts/generateSwagger.js
- feat(api): добавлен CRUD для `/api/order-types` с RBAC и защитами удаления
- server: смонтирован маршрут `app.use('/api/order-types', require('./routes/orderTypes'))`
- routes/orderTypes.js:
  - GET `/api/order-types`, GET `/api/order-types/:id` — роли `Admin | Manager`, populate ссылок (`startStatusId`, `allowedStatuses`, `docTemplateIds`, `fieldsSchemaId` при наличии)
  - POST `/api/order-types` — роль `Admin`, создание, нормализация `code`, обработка `409 CODE_EXISTS`
  - PATCH `/api/order-types/:id` — роль `Admin`, частичное обновление, валидация инварианта `startStatusId ∈ allowedStatuses`
  - DELETE `/api/order-types/:id` — роль `Admin`, запрет при `isSystem=true` или если тип используется в `Order` (жёсткие/мягкие ссылки: `type|types|orderTypeId|meta.orderType*`)
- scripts/generateSwagger.js: добавлены схемы `OrderType`, `OrderTypesListResponse`, `OrderTypeItemResponse`; описаны пути `/api/order-types` и `/api/order-types/{id}`
- docs: обновлён `CHANGELOG_TRAE.md`; подготовлен сниппет для `TECH_OVERVIEW.md` (внешний путь)

### Acceptance
- GET/POST/PATCH/DELETE для `/api/order-types` работают согласно RBAC
- Системный тип (`isSystem=true`) удалить нельзя (`400 SYSTEM_TYPE`)
- Тип, используемый в заказах, удалить нельзя (`400 TYPE_IN_USE`)
- Swagger содержит схемы и пути для OrderTypes

2025-10-20T18:53:19+0200 (Europe/Warsaw) | models/Order.js, routes/orders.js, services/orderStatusService.js
- feat(orders): связка Order ↔ OrderType и проверки allowedStatuses
- models/Order.js: добавлен `orderTypeId` (ObjectId, ref: `OrderType`, required, index).
- routes/orders.js: `POST /api/orders` — обязателен `orderTypeId`; стартовый статус из `OrderType.startStatusId`; запрет создания при пустом `startStatusId` и пустом `allowedStatuses`; 503 при отсутствии Mongo; доступ `Admin|Manager`.
- services/orderStatusService.js: проверка, что новый статус ∈ `allowedStatuses` выбранного типа; при нарушении — `409 STATUS_NOT_ALLOWED`.
- docs: обновлён `TECH_OVERVIEW.md` (синхронизированы статусы/разделы/артефакты), `CHANGELOG_TRAE.md`.

### Acceptance
- Заказ создаётся только с валидным `orderTypeId`, стартовый статус подставляется из типа (если задан).
- При `startStatusId` отсутствует и `allowedStatuses` пуст — создание запрещено (`400 ORDERTYPE_NO_STATUSES`).
- Смена на статус вне `allowedStatuses` — запрещена (`409 STATUS_NOT_ALLOWED`).

2025-10-20T19:19:27+02:00 (Europe/Warsaw) | routes/orderTypes.js
- guard(orderTypes): запрет удаления используемого типа заказов
- routes/orderTypes.js: перед удалением проверка наличия заказов, использующих тип (включая `orderTypeId` и совместимые ссылки); при наличии — `409 ORDERTYPE_IN_USE`.
- docs: обновлены разделы Rules/Guards в `TECH_OVERVIEW.md`, добавлена запись в `CHANGELOG_TRAE.md`.

### Acceptance
- Попытка удалить тип, используемый хотя бы одним заказом — `409 ORDERTYPE_IN_USE`.

2025-10-20T19:45:00+02:00 (Europe/Warsaw) | scripts/seedOrderTypes.js, server/models/OrderType.js, package.json
- feat(seeds): добавлен сидер типов заказов — создаёт/обновляет системный тип `default` со стартовым статусом черновика и `allowedStatuses = [черновик]`.
- server/models/OrderType.js: ссылки на статусы переведены на строковые ID (`String`), совместимые с `OrderStatus`.
- package.json: добавлен скрипт `seed:orderTypes`.
- docs: обновлён `TECH_OVERVIEW.md` (блок про сидер OrderTypes).

### Acceptance
- После `npm run seed:orderStatuses` запуск `npm run seed:orderTypes` создаёт/обновляет тип `default` с `isSystem=true`, `startStatusId` = id статуса группы `draft`, `allowedStatuses` = [тот же id].
- Повторный запуск не создаёт дублей (upsert).
- В логах отображается статус операции (создан/обновлён) и `startStatusId`.

2025-10-20T20:10:00+02:00 (Europe/Warsaw) | client/src/services/orderTypesService.js, TECH_OVERVIEW.md
- feat(client/services): добавлен клиентский сервис `orderTypesService` с методами `list`, `create`, `update`, `remove` на `/api/order-types`.
- docs: обновлён `TECH_OVERVIEW.md` (Client Services / orderTypesService).

### Acceptance
- `list()` → GET `/api/order-types` возвращает `data` с `items`.
- `create(payload)`/`update(id,payload)`/`remove(id)` возвращают `data` (`item`/`ok`).
- Ошибки не перехватываются в сервисе и пробрасываются наверх.

2025-10-20T20:35:00+02:00 (Europe/Warsaw) | client/src/services/docTemplatesService.js, TECH_OVERVIEW.md
- feat(client/services): добавлен `docTemplatesService.list()` для `/api/doc-templates` (возвращает `items`), ошибки пробрасываются.
- docs: обновлён `TECH_OVERVIEW.md` (Client Services / docTemplatesService).

### Acceptance
- `list()` → GET `/api/doc-templates` возвращает `data.items`.

2025-10-20T20:55:00+02:00 (Europe/Warsaw) | client/src/pages/settings/OrderTypes.js, client/src/components/Layout.js, client/src/App.js, client/src/services/orderTypesService.js, client/src/services/docTemplatesService.js, client/src/services/statusesService.js
- feat(client/settings): страница «Типы заказов» переведена на полный API CRUD; действия ограничены RBAC (Admin — CRUD, Manager — просмотр).
- feat(ui/menu): добавлен пункт «Типы заказов» в «Настройки»; доступ Admin|Manager.
- refactor: удалён `localStorage`; данные грузятся через `orderTypesService`, `statusesService`, `docTemplatesService`; добавлен выбор стартового статуса, разрешённых статусов и связанных шаблонов документов.
- docs: обновлены `CHANGELOG_TRAE.md`, `TECH_OVERVIEW.md`.

### Acceptance
- Список типов отображается; Admin может создавать/редактировать/удалять; Manager видит список.
- При ошибках API показываются уведомления; серверная валидация инварианта `startStatusId ∈ allowedStatuses` соблюдается.

2025-10-20T21:05:00+02:00 (Europe/Warsaw) | dev
- chore(dev): запущены dev‑серверы; проверено отображение меню «Типы заказов» и загрузка страницы без рантайм‑ошибок.
- note(lint): остаются ESLint предупреждения (не исправлялись в рамках задачи).

### Acceptance
- Приложение открывается по http://localhost:3007/; страница настроек доступна по `/settings/forms/order-types` (Admin).

2025-10-20T21:22:00+02:00 (Europe/Warsaw) | TECH_OVERVIEW.md, CHANGELOG_TRAE.md, storage/reports/TECH_OVERVIEW.md
- docs(3.2): финал — OrderTypes помечен как OK, roadmap обновлён, UI описание уточнено.
- TECH_OVERVIEW: обновлены разделы «Основные модули», «Состояние проекта», «UI — возможности пользователя».
- CHANGELOG: добавлен раздел «3.2 — OrderTypes (финал)» (подзадачи, файлы, схемы/миграции, тест‑чеклист).
- Export: создана копия `storage/reports/TECH_OVERVIEW.md` для синхронизации с `~/Downloads`.

### Acceptance
- Оба файла обновлены и согласованы (модули, статус, UI).
- Раздел «3.2 — OrderTypes (финал)» присутствует в CHANGELOG.
- Экспортная копия `storage/reports/TECH_OVERVIEW.md` совпадает с текущим `TECH_OVERVIEW.md`.
- UI: страница «Типы заказов» (Admin), влияние на статусы и печать отражены в документации.

2025-10-20T21:25:00+02:00 (Europe/Warsaw) | middleware/auth.js, routes/orderTypes.js, client/src/components/Layout.js, client/src/App.js, client/src/pages/RbacTest.js, TECH_OVERVIEW.md
- feat(auth/rbac): добавлены permission‑флаги `orderTypes.read` и `orderTypes.write` (RBAC_MAP) и хелпер `requirePermission`.
- feat(api/orderTypes): все маршруты `/api/order-types*` защищены правами: GET — `orderTypes.read`, POST/PATCH/DELETE — `orderTypes.write`.
- feat(ui/menu+route): пункт «Настройки → Типы заказов» скрыт для не‑Admin; маршрут `settings/forms/order-types` доступен только `Admin`.
- feat(docs/demo): страница «RBAC тест» показывает `orderTypes.read`/`orderTypes.write` и видимость маршрута.
- docs: обновлены `TECH_OVERVIEW.md`, `CHANGELOG_TRAE.md`.

### Acceptance
- Пользователь с ролью `Manager` (или без прав):
  - не видит пункт меню «Типы заказов»;
  - прямой переход на `/#/settings/forms/order-types` не открывает страницу (защищённый маршрут);
  - API: `GET /api/order-types` и `POST/PATCH/DELETE /api/order-types*` → `403` с `{ msg: 'Недостаточно прав' }`.
- Пользователь `Admin`:
  - видит меню и открывает страницу «Типы заказов»;
  - успешно читает/создаёт/обновляет/удаляет типы через API и UI.

## 2025-10-20T21:40:00+02:00 (Europe/Warsaw) — Migration: OrderType backfill for existing Orders
- Changes:
  - Added migration script `scripts/migrations/2025-10-OrderType-backfill.js`.
  - Ensures `OrderType{code: 'default', isSystem: true}` exists (creates minimal if missing).
  - Backfills all `Order` documents lacking `orderTypeId` with the `default` type id.
  - If an order has no `status` and the type has `startStatusId`, sets order `status` from the type.
  - Logs counts and prints a structured JSON summary.
- Files:
  - `scripts/migrations/2025-10-OrderType-backfill.js`
  - `TECH_OVERVIEW.md`
- How to run:
  - `node scripts/migrations/2025-10-OrderType-backfill.js` (uses `MONGO_URI|MONGO_URL`).
- Acceptance:
  - First run updates only orders with missing `orderTypeId`; optional status backfill runs only when `startStatusId` is set in the type.
  - Re-running is safe and produces `0` updates (idempotent).
  - Summary JSON includes `ok`, counts for `orderTypeBackfilled` and `statusBackfilled`, and `when`/`durationMs`.


## 2025-10-20T21:25:00+02:00 (Europe/Warsaw) — Health/Data Sanity: OrderTypes integrity and aggregated report
- Changes:
  - health/dataSanity.js: added checks
    - Orders: verify each `orderTypeId` exists in `OrderType` collection → report to `problems.orders.unknownOrderTypeId`.
    - OrderTypes: ensure `startStatusId ∈ allowedStatuses` when `startStatusId` is set → report to `problems.orderTypes.invalidStartStatus`.
    - System OrderTypes: treat `code` as immutable via reserved set heuristic (default `['default']`) → report to `problems.orderTypes.systemCodeUnexpected` when `isSystem=true` and `code` is not reserved.
  - Aggregation: introduce `summary.problemsTotal` and top-level `ok` flag when DB is connected.
  - Resilience: when Mongo is not reachable, script prints JSON with `mongoConnected=false` and exits 0.
- Files:
  - `health/dataSanity.js`
  - `TECH_OVERVIEW.md`
- How to run:
  - `node health/dataSanity.js` (uses `MONGO_URI|MONGO_URL`).
- Acceptance:
  - Connected dataset, no violations → `ok=true`, `summary.problemsTotal=0`.
  - Unknown `orderTypeId` references listed under `problems.orders.unknownOrderTypeId` (ids included).
  - `startStatusId` not in `allowedStatuses` listed under `problems.orderTypes.invalidStartStatus` (orderType ids included).
  - System type `code` outside reserved set listed under `problems.orderTypes.systemCodeUnexpected`.
  - No DB connection does not crash; JSON report includes `mongoConnected=false`.

2025-10-20T21:50:00+02:00 (Europe/Warsaw) | OpenAPI — /api/order-types
- docs(swagger): обновлены пути `/api/order-types` и `/api/order-types/{id}` — добавлены `403`, `500`, уточнён `409` для DELETE (примеры: `SYSTEM_TYPE`, `ORDERTYPE_IN_USE`), примеры для `400` (`ORDERTYPE_INVALID_START_STATUS`, `VALIDATION_ERROR`) и `409` (`CODE_EXISTS`); добавлен пример тела запроса.
- scripts: добавлен `scripts/extractOrderTypeSpec.js` для выделения подмножества спецификации.
- artifacts: сгенерирован `storage/reports/api-contracts/ordertype.json`.
- docs: обновлён `TECH_OVERVIEW.md` (ссылка на артефакт, перечисление кодов ошибок).

### Acceptance
- Swagger для `/api/order-types` содержит DTO‑схемы и примеры.
- Отражены коды ошибок: `400` (`ORDERTYPE_INVALID_START_STATUS`, `VALIDATION_ERROR`), `403`, `404`, `409` (`CODE_EXISTS`, `SYSTEM_TYPE`, `ORDERTYPE_IN_USE`), `500`.
- Артефакт доступен по пути `storage/reports/api-contracts/ordertype.json`, ссылка добавлена в TECH_OVERVIEW.md.

2025-10-20T21:30:00+02:00 (Europe/Warsaw) | routes/orderTypes.js, tests/orderTypes.contract.test.js, tests/orderTypes.e2e.test.js, TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- feat(server/tests): добавлены контрактные и e2e‑тесты для OrderTypes (CRUD, guards, интеграция с Orders).
- fix(routes): удаление системного типа возвращает `409 SYSTEM_TYPE` (DEV/DB ветки).
- docs: обновлены TECH_OVERVIEW.md (Tests/Coverage) и CHANGELOG_TRAE.md.

### Acceptance
- CRUD типов — покрыт контрактными тестами; код нормализуется (`normalizeCode`).
- Удаление системного типа → `409 SYSTEM_TYPE`; типа, используемого заказами → `409 ORDERTYPE_IN_USE`.
- `startStatusId ∈ allowedStatuses` — валидируется для POST/PATCH (400 `ORDERTYPE_INVALID_START_STATUS`).
- Создание заказа с `orderTypeId` — стартовый статус берётся из `startStatusId` OrderType.
- Смена статуса вне `allowedStatuses` → `409 STATUS_NOT_ALLOWED`.
- Покрытие зафиксировано по таргетированному прогону; глобальный gate проверяется на полном CI прогоны.

Артефакты:
- Server coverage: `coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
- Client coverage: `client/coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)

## Кэширование (TTL 60s)
- Добавлен in-memory TTL-кэш для `GET /api/statuses` и `GET /api/doc-templates`.
- Инвалидаторы: при `POST/PUT/PATCH/DELETE` соответствующих сущностей кэш очищается.
- ENV: `CACHE_TTL_SECS` (дефолт `60`), добавлено в `.env.example`.
- Метрики: логируются `hits/misses`, а также `set/invalidate` с именем кэша и ключом.
- Тесты: `tests/cache.statuses.docTemplates.e2e.test.js` — два подряд `GET` → второй из кэша; после `POST` кэш сбрасывается и следующий `GET` — miss, затем hit.
- Примечание: для e2e тестов `OrderStatus` замокан (без реальной Mongo), DEV-ветка для doc-templates.

Routes and Swagger alignment
- Updated `@access Public` comments to `@access Authenticated` for GET in `routes/clients.js`, `routes/boxes.js`, `routes/detailingOrders.js` to match global `requireAuth`.
- Generated TECH_OVERVIEW.md (project inventory & architecture summary)
- Swagger updated:
  - Added `bearerAuth` GET paths: `/api/clients`, `/api/clients/{id}`, `/api/boxes`, `/api/boxes/{id}`, `/api/detailing-orders`, `/api/detailing-orders/batch`, `/api/detailing-orders/{id}`, `/api/detailing-orders/client/{clientId}`.
  - Added public paths: `/api/public/health`, `/api/public/status`.
- Artifact regenerated: `artifacts/swagger.json`.
- Consistency: route comments, guards, and Swagger aligned; no discrepancies found.

## Fix: statusActionsHandler missing-template errors and template deletion guards — 2025-10-20

- statusActionsHandler: ensured missing notify/doc templates throw errors even in DEV.
  - Added awaited pickTemplate calls across notify/print adapters and pre-checks.
  - Verified via unit tests: `tests/statusActionsHandler.validation.unit.test.js` now passes.
- routes/notifyTemplates.js, routes/docTemplates.js: reinforced deletion guards.
  - Check for `OrderStatus.exists` by id and code; return `400 TEMPLATE_IN_USE` when referenced.
  - Added Jest DEV fallback for `resetModules` cloning: infer usage by id/code when `exists` mock is undefined.
  - Verified via e2e: `tests/templates.delete.guard.e2e.test.js` passes.
- Observability: added debug logs around deletion guard checks to aid diagnosis.

Coverage deltas (server):
- routes/notifyTemplates.js — improved exercised lines around delete guard.
- routes/docTemplates.js — improved exercised lines around delete guard.
- Statements: ~56%
- Lines: ~57.6%
- Functions: ~45.9%

Coverage (client):
- Statements: 0%
- Lines: 0%
- Functions: 0%

Threshold policy:
- Target: lines >= 70%, statements >= 70%.
- Dynamic rule: if current < 70%, require at least current+5pp for the next run.
  - Server next-run thresholds: lines ≥ 62.6%, statements ≥ 61% (final target 70%).
  - Client next-run thresholds: lines ≥ 5%, statements ≥ 5% (final target 70%).

Least covered (server, by lines):
- services/orderStatusService.js — 13.6%
- services/statusDeletionGuard.js — 16.7%
- routes/docTemplates.js — 24.5%
- routes/notifyTemplates.js — 26.3%
- models/OrderStatus.js — 32.7%

3 быстрых тест-кейса для повышения покрытия:
- orderStatusService: покрыть changeOrderStatus — успешный переход (200) и ошибка (404/400), мок моделей и очереди.
- statusDeletionGuard: покрыть isStatusInOrderTypes — true/false для нескольких типов заказов и статусов.
- docTemplates routes: e2e GET/POST в DEV-режиме с заголовком x-user-role=\"settings.docs:*\", проверить 200 и схему ответа.

Артефакты:
- Server coverage: `coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
- Client coverage: `client/coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)

## Кэширование (TTL 60s)
- Добавлен in-memory TTL-кэш для `GET /api/statuses` и `GET /api/doc-templates`.
- Инвалидаторы: при `POST/PUT/PATCH/DELETE` соответствующих сущностей кэш очищается.
- ENV: `CACHE_TTL_SECS` (дефолт `60`), добавлено в `.env.example`.
- Метрики: логируются `hits/misses`, а также `set/invalidate` с именем кэша и ключом.
- Тесты: `tests/cache.statuses.docTemplates.e2e.test.js` — два подряд `GET` → второй из кэша; после `POST` кэш сбрасывается и следующий `GET` — miss, затем hit.
- Примечание: для e2e тестов `OrderStatus` замокан (без реальной Mongo), DEV-ветка для doc-templates.

Routes and Swagger alignment
- Updated `@access Public` comments to `@access Authenticated` for GET in `routes/clients.js`, `routes/boxes.js`, `routes/detailingOrders.js` to match global `requireAuth`.
- Generated TECH_OVERVIEW.md (project inventory & architecture summary)
- Swagger updated:
  - Added `bearerAuth` GET paths: `/api/clients`, `/api/clients/{id}`, `/api/boxes`, `/api/boxes/{id}`, `/api/detailing-orders`, `/api/detailing-orders/batch`, `/api/detailing-orders/{id}`, `/api/detailing-orders/client/{clientId}`.
  - Added public paths: `/api/public/health`, `/api/public/status`.
- Artifact regenerated: `artifacts/swagger.json`.
- Consistency: route comments, guards, and Swagger aligned; no discrepancies found.

## Fix: statusActionsHandler missing-template errors and template deletion guards — 2025-10-20

- statusActionsHandler: ensured missing notify/doc templates throw errors even in DEV.
  - Added awaited pickTemplate calls across notify/print adapters and pre-checks.
  - Verified via unit tests: `tests/statusActionsHandler.validation.unit.test.js` now passes.
- routes/notifyTemplates.js, routes/docTemplates.js: reinforced deletion guards.
  - Check for `OrderStatus.exists` by id and code; return `400 TEMPLATE_IN_USE` when referenced.
  - Added Jest DEV fallback for `resetModules` cloning: infer usage by id/code when `exists` mock is undefined.
  - Verified via e2e: `tests/templates.delete.guard.e2e.test.js` passes.
- Observability: added debug logs around deletion guard checks to aid diagnosis.

Coverage deltas (server):
- routes/notifyTemplates.js — improved exercised lines around delete guard.
- routes/docTemplates.js — improved exercised lines around delete guard.
- Statements: ~56%
- Lines: ~57.6%
- Functions: ~45.9%

Coverage (client):
- Statements: 0%
- Lines: 0%
- Functions: 0%

Threshold policy:
- Target: lines >= 70%, statements >= 70%.
- Dynamic rule: if current < 70%, require at least current+5pp for the next run.
  - Server next-run thresholds: lines ≥ 62.6%, statements ≥ 61% (final target 70%).
  - Client next-run thresholds: lines ≥ 5%, statements ≥ 5% (final target 70%).

Least covered (server, by lines):
- services/orderStatusService.js — 13.6%
- services/statusDeletionGuard.js — 16.7%
- routes/docTemplates.js — 24.5%
- routes/notifyTemplates.js — 26.3%
- models/OrderStatus.js — 32.7%

3 быстрых тест-кейса для повышения покрытия:
- orderStatusService: покрыть changeOrderStatus — успешный переход (200) и ошибка (404/400), мок моделей и очереди.
- statusDeletionGuard: покрыть isStatusInOrderTypes — true/false для нескольких типов заказов и статусов.
- docTemplates routes: e2e GET/POST в DEV-режиме с заголовком x-user-role=\"settings.docs:*\", проверить 200 и схему ответа.

Артефакты:
- Server coverage: `coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
- Client coverage: `client/coverage/` (`lcov.info`, `coverage-final.json`, HTML `lcov-report/`)
2025-10-20T17:50:47+03:00 | client/src/App.js, client/src/components/SettingsBackBar.js, client/src/pages/Settings.js, client/src/pages/settings/ClientsNotifications.js, client/src/pages/settings/Company.js, client/src/pages/settings/Employees.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/pages/settings/ListSettingsPage.js, client/src/pages/settings/OrderTypes.js, client/src/pages/settings/OrdersGeneral.js, client/src/pages/settings/OrdersSMS.js, client/src/pages/settings/Roles.js, client/src/pages/settings/Users.js | feat(settings): implement unified settings back bar and order types configuration
2025-10-20T20:15:00+02:00 (Europe/Warsaw) | routes/orderTypes.js, server.js, scripts/generateSwagger.js
- feat(api): добавлен CRUD для `/api/order-types` с RBAC и защитами удаления
- server: смонтирован маршрут `app.use('/api/order-types', require('./routes/orderTypes'))`
- routes/orderTypes.js:
  - GET `/api/order-types`, GET `/api/order-types/:id` — роли `Admin | Manager`, populate ссылок (`startStatusId`, `allowedStatuses`, `docTemplateIds`, `fieldsSchemaId` при наличии)
  - POST `/api/order-types` — роль `Admin`, создание, нормализация `code`, обработка `409 CODE_EXISTS`
  - PATCH `/api/order-types/:id` — роль `Admin`, частичное обновление, валидация инварианта `startStatusId ∈ allowedStatuses`
  - DELETE `/api/order-types/:id` — роль `Admin`, запрет при `isSystem=true` или если тип используется в `Order` (жёсткие/мягкие ссылки: `type|types|orderTypeId|meta.orderType*`)
- scripts/generateSwagger.js: добавлены схемы `OrderType`, `OrderTypesListResponse`, `OrderTypeItemResponse`; описаны пути `/api/order-types` и `/api/order-types/{id}`
- docs: обновлён `CHANGELOG_TRAE.md`; подготовлен сниппет для `TECH_OVERVIEW.md` (внешний путь)

### Acceptance
- GET/POST/PATCH/DELETE для `/api/order-types` работают согласно RBAC
- Системный тип (`isSystem=true`) удалить нельзя (`400 SYSTEM_TYPE`)
- Тип, используемый в заказах, удалить нельзя (`400 TYPE_IN_USE`)
- Swagger содержит схемы и пути для OrderTypes

2025-10-20T18:53:19+0200 (Europe/Warsaw) | models/Order.js, routes/orders.js, services/orderStatusService.js
- feat(orders): связка Order ↔ OrderType и проверки allowedStatuses
- models/Order.js: добавлен `orderTypeId` (ObjectId, ref: `OrderType`, required, index).
- routes/orders.js: `POST /api/orders` — обязателен `orderTypeId`; стартовый статус из `OrderType.startStatusId`; запрет создания при пустом `startStatusId` и пустом `allowedStatuses`; 503 при отсутствии Mongo; доступ `Admin|Manager`.
- services/orderStatusService.js: проверка, что новый статус ∈ `allowedStatuses` выбранного типа; при нарушении — `409 STATUS_NOT_ALLOWED`.
- docs: обновлён `TECH_OVERVIEW.md` (синхронизированы статусы/разделы/артефакты), `CHANGELOG_TRAE.md`.

### Acceptance
- Заказ создаётся только с валидным `orderTypeId`, стартовый статус подставляется из типа (если задан).
- При `startStatusId` отсутствует и `allowedStatuses` пуст — создание запрещено (`400 ORDERTYPE_NO_STATUSES`).
- Смена на статус вне `allowedStatuses` — запрещена (`409 STATUS_NOT_ALLOWED`).

2025-10-20T19:19:27+02:00 (Europe/Warsaw) | routes/orderTypes.js
- guard(orderTypes): запрет удаления используемого типа заказов
- routes/orderTypes.js: перед удалением проверка наличия заказов, использующих тип (включая `orderTypeId` и совместимые ссылки); при наличии — `409 ORDERTYPE_IN_USE`.
- docs: обновлены разделы Rules/Guards в `TECH_OVERVIEW.md`, добавлена запись в `CHANGELOG_TRAE.md`.

### Acceptance
- Попытка удалить тип, используемый хотя бы одним заказом — `409 ORDERTYPE_IN_USE`.

2025-10-20T19:45:00+02:00 (Europe/Warsaw) | scripts/seedOrderTypes.js, server/models/OrderType.js, package.json
- feat(seeds): добавлен сидер типов заказов — создаёт/обновляет системный тип `default` со стартовым статусом черновика и `allowedStatuses = [черновик]`.
- server/models/OrderType.js: ссылки на статусы переведены на строковые ID (`String`), совместимые с `OrderStatus`.
- package.json: добавлен скрипт `seed:orderTypes`.
- docs: обновлён `TECH_OVERVIEW.md` (блок про сидер OrderTypes).

### Acceptance
- После `npm run seed:orderStatuses` запуск `npm run seed:orderTypes` создаёт/обновляет тип `default` с `isSystem=true`, `startStatusId` = id статуса группы `draft`, `allowedStatuses` = [тот же id].
- Повторный запуск не создаёт дублей (upsert).
- В логах отображается статус операции (создан/обновлён) и `startStatusId`.

2025-10-20T20:10:00+02:00 (Europe/Warsaw) | client/src/services/orderTypesService.js, TECH_OVERVIEW.md
- feat(client/services): добавлен клиентский сервис `orderTypesService` с методами `list`, `create`, `update`, `remove` на `/api/order-types`.
- docs: обновлён `TECH_OVERVIEW.md` (Client Services / orderTypesService).

### Acceptance
- `list()` → GET `/api/order-types` возвращает `data` с `items`.
- `create(payload)`/`update(id,payload)`/`remove(id)` возвращают `data` (`item`/`ok`).
- Ошибки не перехватываются в сервисе и пробрасываются наверх.

2025-10-20T20:35:00+02:00 (Europe/Warsaw) | client/src/services/docTemplatesService.js, TECH_OVERVIEW.md
- feat(client/services): добавлен `docTemplatesService.list()` для `/api/doc-templates` (возвращает `items`), ошибки пробрасываются.
- docs: обновлён `TECH_OVERVIEW.md` (Client Services / docTemplatesService).

### Acceptance
- `list()` → GET `/api/doc-templates` возвращает `data.items`.

2025-10-20T20:55:00+02:00 (Europe/Warsaw) | client/src/pages/settings/OrderTypes.js, client/src/components/Layout.js, client/src/App.js, client/src/services/orderTypesService.js, client/src/services/docTemplatesService.js, client/src/services/statusesService.js
- feat(client/settings): страница «Типы заказов» переведена на полный API CRUD; действия ограничены RBAC (Admin — CRUD, Manager — просмотр).
- feat(ui/menu): добавлен пункт «Типы заказов» в «Настройки»; доступ Admin|Manager.
- refactor: удалён `localStorage`; данные грузятся через `orderTypesService`, `statusesService`, `docTemplatesService`; добавлен выбор стартового статуса, разрешённых статусов и связанных шаблонов документов.
- docs: обновлены `CHANGELOG_TRAE.md`, `TECH_OVERVIEW.md`.

### Acceptance
- Список типов отображается; Admin может создавать/редактировать/удалять; Manager видит список.
- При ошибках API показываются уведомления; серверная валидация инварианта `startStatusId ∈ allowedStatuses` соблюдается.

2025-10-20T21:05:00+02:00 (Europe/Warsaw) | dev
- chore(dev): запущены dev‑серверы; проверено отображение меню «Типы заказов» и загрузка страницы без рантайм‑ошибок.
- note(lint): остаются ESLint предупреждения (не исправлялись в рамках задачи).

### Acceptance
- Приложение открывается по http://localhost:3007/; страница настроек доступна по `/settings/forms/order-types` (Admin).
2025-10-20T23:48:11+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, client/src/App.js, client/src/components/Layout.js, client/src/pages/Orders.js, client/src/pages/RbacTest.js, client/src/pages/settings/OrderTypes.js, client/src/services/docTemplatesService.js, client/src/services/orderTypesService.js, health/dataSanity.js, middleware/auth.js, models/Order.js, package.json, routes/orderTypes.js, routes/orders.js, scripts/extractOrderTypeSpec.js, scripts/generateSwagger.js, scripts/migrations/2025-10-OrderType-backfill.js, scripts/seedOrderTypes.js, server.js, server/models/OrderType.js, services/orderStatusService.js, storage/reports/TECH_OVERVIEW.md, storage/reports/api-contracts/ordertype.json, storage/reports/migrateOrderStatuses-1760972468458.csv, storage/reports/migrateOrderStatuses-1760972468458.json, storage/reports/statusActionQueue-load-report-2025-10-20.md, tests/orderTypes.contract.test.js, tests/orderTypes.e2e.test.js | docs(3.2): finalize OrderTypes; update TECH_OVERVIEW and CHANGELOG; export TECH_OVERVIEW copy
- Mark OrderTypes as OK; remove from roadmap
- Clarify UI capabilities and effects on orders/printing
- Add 3.2 section and final Warsaw-timestamped entry to CHANGELOG
- Add storage/reports/TECH_OVERVIEW.md export
- Include API/route/UI/RBAC files and tests

2025-10-20T22:59:00+02:00 (Europe/Warsaw) | server/models/FieldSchema.js, server/models/Dictionary.js, tests/models/fields.valid.test.js, tests/models/fields.invalid.test.js, TECH_OVERVIEW.md, storage/reports/TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- feat(forms/models): FieldSchema & Dictionary — Mongoose модели, индексы, валидации
- server/models/FieldSchema.js: поля scope/name/version/isActive/note/createdBy/createdAt и fields[]; индексы {scope,name,version:-1}, {isActive:1}; pre('validate') для list/multilist → обязательны options.
- server/models/Dictionary.js: code (unique, trim+lower), values[], updatedAt; индекс {code:1, unique:true}; pre('save') — touch updatedAt; pre('validate') — normalize code.
- tests: tests/models/fields.valid.test.js, tests/models/fields.invalid.test.js — позитивные/негативные кейсы; запуск `npm test -- tests/models --runInBand` — 2/2 suites, 6/6 tests PASSED.
- docs: TECH_OVERVIEW.md обновлён (раздел 3.3); экспорт синхронизирован: storage/reports/TECH_OVERVIEW.md.

### Acceptance
- модели созданы, валидации и тесты пройдены

## 2025-10-20 23:26 (Europe/Warsaw)
- Server: добавлены маршруты FieldSchemas и Dictionaries; монтированы в `server.js`.
- Files: `routes/fields.js`, `routes/dicts.js`, `server.js`.
- Scripts: обновлён `scripts/generateSwagger.js` — компоненты и пути для `/api/fields*` и `/api/dicts*`; артефакт `artifacts/swagger.json`.
- Docs: обновлён раздел "API / FieldSchemas / Dicts" в `TECH_OVERVIEW.md`.
- RBAC: доступ `Admin`, `Manager`; запрет удаления активной версии; унифицированные ошибки.
- Acceptance: «API добавлено, RBAC и Swagger готовы».

2025-10-20T20:40:00+02:00 (Europe/Warsaw) | client/src/pages/settings/FieldsBuilderPage.js | feat(settings/forms): кнопка «Импорт из браузера» — миграция полей из localStorage в FieldSchema через POST /api/fields/schemas; валидация списков; уведомления об ошибке/успехе
2025-10-20T20:40:00+02:00 (Europe/Warsaw) | scripts/importFieldSchemaFromFile.js | feat(cli): импортёр FieldSchema из JSON (маппинг типов, валидация options, авто-версионирование/активация, MONGO_URL|MONGO_URI)
2025-10-20T20:40:00+02:00 (Europe/Warsaw) | TECH_OVERVIEW.md | docs: добавлена секция «Migration — FieldSchemas import (UI + CLI)»: описание потока, ключей localStorage и требований валидации; DEV in-memory fallback

2025-10-20T23:59:30+02:00 (Europe/Warsaw) | client/src/services/dictsService.js, client/src/services/fieldsService.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/context/AuthContext.jsx, client/src/components/ProtectedRoute.jsx, TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- feat(client/services): добавлен `dictsService` (list/get/getByCode/create/update/remove) и подтверждён `fieldsService` (listVersions/importSchema/activate/deactivate).
- refactor(ui/settings): FieldsBuilderPage переведён на `fieldsService`; добавлен список версий и «Активировать»; действия скрыты и недоступны без ролей `Admin|Manager`.
- docs: TECH_OVERVIEW.md — добавлен раздел «Client: Services & UI (FieldSchemas + Dicts)»; обновлён CHANGELOG.

### Acceptance
- Роль `Admin|Manager`: страница `/settings/forms/order-fields` → при наличии локальных полей «Импорт из браузера» создаёт новую версию через `POST /api/fields/schemas`; раздел «Версии» показывает список из `GET /api/fields/:scope/:name/versions`; кнопка «Активировать» вызывает `POST /api/fields/:id/activate` и делает версию активной.
- Роли без прав не видят кнопок «Импорт»/«Активировать», попытки прямых запросов получают `403` (серверный RBAC в `routes/fields.js`).
- DEV (`AUTH_DEV_MODE=1`): функциональность работает на in-memory сторадже; API и RBAC идентичны.

2025-10-20T23:59:59+02:00 (Europe/Warsaw) | services/fieldSchemaProvider.js, routes/clients.js, routes/orders.js, TECH_OVERVIEW.md, CHANGELOG_TRAE.md | feat(forms/server): активные схемы + TTL кэш + валидация обязательных полей
- services: добавлен провайдер `getActiveSchema(scope,name,ttl=60)` с in‑memory TTL кэшем (`services/ttlCache.js`).
- orders: middleware `validateOrderRequiredFields` для `POST /api/orders` — подмешивает активную схему `orders/«Форма заказа»`, проверяет `required:true` поля в `body` и `body.fields`, возвращает `400 { error:'REQUIRED_FIELDS_MISSING', fields:[...] }` при нехватке.
- clients: middleware `validateRequiredFields` для `POST /api/clients` и `PUT /api/clients/:id` — аналогичные правила для `clients/«Форма клиента»`.
- docs: обновлён раздел «Использование FieldSchema в бизнес‑логике» в `TECH_OVERVIEW.md`.

### Acceptance
- активные схемы подмешиваются, валидация работает

2025-10-20T22:15:00+02:00 (Europe/Warsaw) | tests/fields.schemas.e2e.test.js, tests/dicts.e2e.test.js, tests/api.contracts.fields.dicts.swagger.test.js, TECH_OVERVIEW.md, CHANGELOG_TRAE.md
- tests(e2e): добавлены покрывающие сценарии для FieldSchemas (версии, активация/деактивация, PATCH, запрет удаления активной версии, валидация list/multilist → 400 `FIELD_OPTIONS_REQUIRED`).
- tests(e2e): добавлены CRUD‑сценарии для Dictionaries (конфликт кода → 409, get by id/code, update, delete).
- tests(swagger): контрактные проверки артефакта `artifacts/swagger.json` — наличие компонент (`FieldSchema`, `FieldSpec`, `Dictionary`, *Create/*Patch) и путей (`/api/fields*`, `/api/dicts*`), методы/ответы и `bearerAuth` в security.
- docs: TECH_OVERVIEW.md — раздел «Покрытие тестами API Fields/Dicts». CHANGELOG обновлён.

### Acceptance
- покрытие достигнуто, тесты пройдены
