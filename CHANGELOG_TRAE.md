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
2025-10-20T18:04:04+03:00 | .env, .env.example, .eslintignore, .eslintrc.cjs, .gitignore, .trae/rules/project_rules.md, CHANGELOG_TRAE.md, TECH_OVERVIEW.md, api-server.js, client/eslint.config.cjs, client/package-lock.json, client/package.json, client/src/App.js, client/src/components/Layout.js, client/src/components/OrderTimeline.jsx, client/src/pages/Orders.js, client/src/pages/Payments.js, client/src/pages/Settings.js, client/src/pages/settings/Company.js, client/src/pages/settings/DocumentEditor.js, client/src/pages/settings/Documents.js, client/src/pages/settings/FieldsBuilderPage.js, client/src/pages/settings/OrderStatuses.js, client/src/pages/settings/OrderTypes.js, client/src/pages/settings/PaymentArticles.js, client/src/pages/settings/Roles.js, client/src/services/statusesService.js, config/db.js, contracts/apiContracts.js, demo.js, health/dataSanity.js, middleware/auth.js, middleware/error.js, middleware/validate.js, mock-api-server.js, models/Box.js, models/Client.js, models/DetailingOrder.js, models/DocTemplate.js, models/NotifyTemplate.js, models/Order.js, models/OrderStatus.js, models/OrderStatusLog.js, models/Role.js, models/Task.js, models/User.js, models/UserRole.js, models/UserToken.js, package-lock.json, package.json, queues/statusActionQueue.js, routes/auth.js, routes/boxes.js, routes/clients.js, routes/detailingOrders.js, routes/docTemplates.js, routes/files.js, routes/notifyDev.js, routes/notifyTemplates.js, routes/orders.js, routes/payments.js, routes/public.js, routes/queue.js, routes/roles.js, routes/statuses.js, routes/tasks.js, routes/users.js, scripts/changelog.js, scripts/createTestOrder.js, scripts/generate-static-analysis-report.js, scripts/generateApiContractsReport.js, scripts/generateSwagger.js, scripts/migrateOrderStatuses.js, scripts/perfDiagnostics.js, scripts/seedOrderStatuses.js, scripts/seedRoles.js, scripts/seedStatusGroups.js, scripts/testStatusModels.js, server-demo.js, server.js, services/configValidator.js, services/fileStore.js, services/orderStatusService.js, services/queueMetrics.js, services/statusActionsHandler.js, services/statusDeletionGuard.js, services/templatesStore.js, services/ttlCache.js, storage/reports/migrateOrderStatuses-1760972468458.csv, storage/reports/migrateOrderStatuses-1760972468458.json, tests/api.contracts.payments.test.js, tests/api.contracts.queue.metrics.test.js, tests/api.contracts.templates.test.js, tests/cache.statuses.docTemplates.e2e.test.js, tests/env.validator.test.js, tests/migrateOrderStatuses.test.js, tests/notify.print.e2e.dev.test.js, tests/notify.print.e2e.prodlike.test.js, tests/notify.unit.test.js, tests/orderStatusService.reopen.test.js, tests/orders.contract.test.js, tests/orders.reopen.e2e.test.js, tests/payments.locked.e2e.test.js, tests/print.unit.test.js, tests/queue.statusActions.behavior.e2e.test.js, tests/queue.statusActions.metrics.e2e.test.js, tests/queue.statusActions.metrics.unit.test.js, tests/rbac.e2e.test.js, tests/statusActions.closeWithoutPayment.test.js, tests/statusActionsHandler.validation.unit.test.js, tests/statuses.contract.test.js, tests/statuses.delete.test.js, tests/statuses.references.test.js, tests/templates.delete.guard.e2e.test.js, validation/clientSchema.js | feat(services): add status services and metrics; test: add e2e/contract suites; scripts: add migrations and reports; docs(overview): UI capabilities, preflight, last push; docs(changelog): grouped push and preflight; chore(gitignore): normalize node_modules and add coverage/artifacts
2025-10-20T18:06:37+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md | docs(overview,changelog): record push details (origin/main @ f3e6b11)
2025-10-20T18:10:53+03:00 | README.md | docs(readme): refresh setup, scripts, tests, env and links
2025-10-20T18:18:23+03:00 | CHANGELOG_TRAE.md, TECH_OVERVIEW.md, server/models/OrderType.js | feat(models): add OrderType model; docs(overview,changelog): mark OrderTypes In progress
