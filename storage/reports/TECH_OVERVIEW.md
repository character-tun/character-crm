# TECH_OVERVIEW — Character CRM / TRAE

> Последний пуш
- Дата/время: 2025-10-20 18:02 (локальное)
- Ветвь: main (подготовка)
- Ключевые файлы (≤10): server.js; services/orderStatusService.js; services/statusActionsHandler.js; services/templatesStore.js; services/queueMetrics.js; scripts/migrateOrderStatuses.js; scripts/generateSwagger.js; tests/rbac.e2e.test.js; tests/queue.statusActions.metrics.e2e.test.js; CHANGELOG_TRAE.md
- Preflight: .gitignore обновлён; .env удалён из индекса; очищены client/coverage, coverage, artifacts, node_modules, .DS_Store
- Tests: failed
- Commit: f3e6b11
- Push: origin/main @ f3e6b11 (https://github.com/character-tun/character-crm/tree/main)

## 1. Архитектура и стек
- Архитектура: `server` (Node.js/Express/MongoDB/Queues) + `client` (React). Один репозиторий, общие тесты и утилиты.
- Стек: `Node.js`, `Express`, `MongoDB (Mongoose)`, `BullMQ` (с Redis; мем-режим в DEV), `React`, `Jest`, `Supertest`, `Zod/Joi`, `Helmet`, `CORS`, `dotenv`.
- Режимы: `DEV` (упрощённые ветки, in-memory fallback при `AUTH_DEV_MODE=1`) и `PROD` (Mongo/Redis, реальная печать/уведомления).
- Очередь: `queues/statusActionQueue.js` — обработка авто-действий статусов (BullMQ или мем-очередь), ретраи/идемпотентность, метрики.
- Кэш: in-memory TTL для `GET /api/statuses` и `GET /api/doc-templates` (`services/ttlCache.js`, `CACHE_TTL_SECS`).
- Разделение ролей: `server` (API, модели, сервисы, очереди), `client` (UI), `tests` (unit/e2e), `scripts` (генераторы, миграции, диагностика), `storage/reports` (артефакты).

## 2. Структура проекта
- `server.js` — основное приложение Express: маршруты, глобальные guard’ы, error handler.
- `routes/` — REST‑маршруты: `statuses`, `orders`, `payments`, `docTemplates`, `notifyTemplates`, `auth`, `public`, и т.п.
- `models/` — Mongoose‑модели: `Order`, `OrderStatus`, `OrderStatusLog`, `DocTemplate`, `NotifyTemplate`, `User`, `Role`, `UserRole`, `UserToken`, и др.
- `services/` — бизнес‑логика: `statusActionsHandler` (auto‑actions), `orderStatusService`, `templatesStore` (DEV in‑memory), `statusDeletionGuard`, `ttlCache`, `configValidator`, `fileStore`.
- `queues/` — очередь действий статусов: `statusActionQueue.js` (BullMQ/мем, метрики/повторы).
- `middleware/` — `auth.js` (RBAC/withUser/requireRole), `error.js` (унифицированные ошибки), `validate.js`.
- `scripts/` — `generateSwagger.js`, `generateApiContractsReport.js`, `migrateOrderStatuses.js`, `perfDiagnostics.js`, `seed*.js`, `changelog.js`.
- `tests/` — unit/e2e/контракты/миграции/очередь/RBAC/валидация сред; покрытие и отчёты.
- `storage/reports/` — артефакты: ESLint/Static Analysis/Perf/Load/Contracts/Migration.
- `health/` — `dataSanity.js` (проверка консистентности данных).
- `validation/` — схемы клиента (например, `clientSchema.js`).
- `client/` — React‑приложение: страницы, контексты, компоненты, темы, сервисы API.
- `package.json` — скрипты: `start`, `server` (nodemon), `client` (CRA dev), `dev` (concurrently), `build`, `test` (jest). Клиент: `start`, `build`, `test`.

## 3. Основные модули и логика
- Auth/RBAC: `middleware/auth.js` — `withUser` (из заголовков или JWT), `requireAuth`, `requireRole/requireAnyRole`. DEV‑режим допускает упрощённые роли и инлайн‑пользователя.
- Пользователи и роли: модели `User`, `Role`, `UserRole`, `UserToken` — хранение пользователей, ролей, связей и токенов (детали в моделях).
- Статусы заказов: `OrderStatus`/`Order` — группы (`GROUPS`: draft/in_progress/closed_*), порядок, авто‑действия (настройки на статусах).
- Очередь статусов: `statusActionQueue` — запуск auto‑actions (`closeWithoutPayment`, `notify`, `print`, `payrollAccrual`). Мем‑очередь в DEV, BullMQ в PROD. Метрики, ретраи, идемпотентность.
- Payments guard: защита закрытия с учётом оплат; соответствующие контракты и е2е покрытие.
- Templates: `DocTemplate`/`NotifyTemplate` — CRUD, RBAC, проверки связей на удаление (guard против использования в статусах). DEV‑ветка — in‑memory `TemplatesStore`.
- OrderTypes: модель `OrderType` (типы заказов) — стартовый статус, разрешённые статусы, схема полей, шаблоны документов; валидаторы: `startStatusId ∈ allowedStatuses`, `code → lowercase/trim`; статус — OK.
- Миграции и утилиты: `migrateOrderStatuses.js` (CSV/JSON отчёты), `health/dataSanity.js`, `scripts/perfDiagnostics.js`, `services/configValidator.js`.
- CLIENT: страницы (Login, Settings, Users, Roles, Payments, OrderStatuses, Queues, BootstrapWizard, RBAC Test), `AuthContext`, `ProtectedRoute`, API‑сервисы.

## 4. Тестирование
- Jest/Supertest: unit и e2e, плюс контрактные тесты API.
- Покрытие: server HTML/JSON (`coverage/`), client (`client/coverage/`). Динамические пороги: рост на +5pp до цели 70%.
- Категории: `services`, `routes`, `migrations`, `env validator`, `queue behavior`, `rbac e2e`, `contracts`.
- Артефакты: `storage/reports/*.json|*.md` (ESLint, статический анализ, perf, load, contracts, миграции).

## 5. Конфигурация и ENV
- Основные переменные: `MONGO_URL|MONGO_URI`, `REDIS_URL|REDIS_HOST|REDIS_PORT`, `AUTH_DEV_MODE`, `JWT_SECRET`, `SMTP_*`, `NOTIFY_DRY_RUN`, `PRINT_DRY_RUN`, `CACHE_TTL_SECS`, `CORS_ORIGIN`.
- DEV vs PROD: DEV — упрощённые ветки, мем‑очередь/ин‑мем шаблоны, быстрые проверки; PROD — реальные интеграции, Mongo/Redis, печать/уведомления.
- Валидация: `services/configValidator.js` — проверка ENV и безопасных дефолтов.

## 6. Безопасность
- `Helmet`, `CORS`, блок HTTP методов `TRACE`/`TRACK`.
- RBAC: `requireAuth` глобально, `requireRole` на маршрутах, тонкая настройка прав.
- Валидации входных данных: `POST/PATCH` проверяются схемами/правилами, строгие ошибки 400/409.
- Логи и маскирование: исключаем чувствительные поля из логов/ответов; единый error handler.

## 7. Производительность
- Индексы: `Orders(status,statusChangedAt)`, `OrderStatus(group,order)`, `OrderStatusLog(orderId,createdAt)`.
- Отчёты: `scripts/perfDiagnostics.js` (p50/p95), рекомендации по кэшированию TTL, батчам, очередям.
- Мини‑нагрузка: 200× `PATCH /api/orders/:id/status` (DEV‑ветка), проверка дедлоков/метрик.

## 8. Скрипты и инструменты
- Генераторы/сервисы: `generateSwagger`, `generateApiContractsReport`, `seed*`, `migrateOrderStatuses`, `perfDiagnostics`, `changelog`.
- Формат артефактов: Markdown/JSON в `storage/reports/`.

## 9. Тест‑ран и пороги
- Команды: `npm test -- --coverage --runInBand`, `CI=true npm run test -- --coverage --watchAll=false`.
- Пороги: динамический gate — минимум текущий+5pp до целевого `70%`.
- CI‑gate: блокирует, если покрытие ниже динамической планки.

## 10. CHANGELOG и артефакты
- `CHANGELOG_TRAE.md` — записи по задачам/дате/разделам (Linting, Static Analysis, Perf, Queues, Routes и т.п.).
- Основные отчёты: `api-rbac-inventory`, `static-analysis`, `perf-report`, `statusActionQueue-load-report`, `api-contracts`, `dataSanity`, `env-validator`.

## 11. Состояние проекта (на дату генерации)
- Модули → Статус:
  - Auth/RBAC — OK
  - Statuses API/Auto‑actions — OK
  - Doc/Notify Templates CRUD/guards — OK
  - Queue (BullMQ/мем, метрики) — OK
  - TTL‑кэш (statuses/doc‑templates) — OK
  - Orders/Payments — In progress
  - Client pages (Settings/Users/Roles/Payments/Statuses/Queues) — In progress
  - OrderTypes — OK
  - Payments real model — TODO
  - Notifications center — TODO
  - SaaS multi‑tenant — TODO
- Следующие этапы: `3.3 Payments real model`, `3.4 Notifications center`, `3.5 SaaS multi-tenant`.

## 12. UI — возможности пользователя (текущее состояние)
- Авторизация и доступ: вход/выход (DEV — через заголовки `x-user-*`, PROD — через JWT), автоматическое обновление токена; RBAC скрывает недоступные пункты меню и действия.
- Задачи: доска и список задач; просмотр, создание, редактирование, удаление; перемещение между колонками и изменение порядка; детальная карточка задачи.
- Заказы: просмотр и фильтрация по типам/клиенту; ведение работ, платежей и задач; вычисление сумм/оплаты/прибыли; тип заказа определяет стартовый и допустимые статусы; печатные формы по шаблонам, связанным с OrderType.
- Платежи: создание приходов/расходов, редактирование/удаление; сводные итоги (приход/расход/сальдо); фильтр по клиенту/заказу; экспорт в CSV; печать квитанции по шаблону.
- Клиенты: список с атрибутами и тегами; быстрые переходы к связанным заказам и платежам.
- Услуги: древовидные категории и каталог; CRUD услуг (цена, себестоимость, гарантия, вознаграждение).
- Настройки: пользователи и роли (CRUD); документы (настройка шаблонов); платежные статьи и методы; типы заказов (CRUD: стартовый статус, разрешённые статусы, связанные шаблоны документов; доступ только Admin); поля заказа; типы и поля клиента; справочники.
- Инвентарь: заказы поставок и платежи поставщикам (прототип); поставщики; агрегированные итоги по задолженности.
- Проверка прав (RBAC Test): интерактивная страница, показывающая доступные разделы и действия для текущих ролей.
- DEV‑режим и ограничения: часть страниц хранит данные в `localStorage` (прототипирование); серверные интеграции подключаются постепенно (Orders/Payments — в разработке); реалистичная печать/уведомления — в PROD, в DEV — dry‑run.
## 13. CI/VC-процессы
- Preflight (gitignore, секреты, мусор) — OK: .gitignore → нормализован `node_modules/` (было `node_modules`), добавлены `coverage/`, `client/coverage/`, `artifacts/`; из индекса удалены `.env`, `client/coverage`, `coverage`, `artifacts`, `node_modules`, `.DS_Store`. Tests: failed.
- Коммиты: conventional commits; автообновление CHANGELOG; артефакты и отчёты — `storage/reports/`.

### Health — Data Sanity (update)
- Added checks for `OrderTypes` and `Orders ↔ OrderTypes` integrity.
- New rules:
  - Orders: every `orderTypeId` must exist in `OrderType` collection → otherwise record in `problems.orders.unknownOrderTypeId`.
  - OrderTypes: if `startStatusId` is set, it must be present in `allowedStatuses` → `problems.orderTypes.invalidStartStatus`.
  - System OrderTypes: `code` is immutable by policy; heuristic check — `code` must be from reserved set (default: `['default']`) → `problems.orderTypes.systemCodeUnexpected` when violated.
- Report shape additions:
  - `summary.orderTypesCount`, `summary.problemsTotal`, top-level `ok` flag.
  - `problems.orderTypes.{invalidStartStatus, systemCodeUnexpected}`, `problems.orders.unknownOrderTypeId`.
- Run:
  - `node health/dataSanity.js` (uses `MONGO_URI|MONGO_URL`).
- Notes:
  - If Mongo isn’t reachable, `mongoConnected=false` and report still prints (no crash). `ok` reflects aggregated result only when checks run; with no DB it remains `false`.

## Migration — OrderType backfill (2025-10)
- Script: `scripts/migrations/2025-10-OrderType-backfill.js`
- Goal: ensure backward compatibility for existing orders.
- Steps:
  - Ensure system `OrderType` with `code='default'` exists (create minimal if missing).
  - For orders with missing `orderTypeId`, set it to `default`'s id.
  - If order `status` is missing and type has `startStatusId`, set `status` from the type.
- Idempotent: repeated runs yield `0` updates once the dataset is consistent.
- Logging:
  - Counts: `orders updated (orderTypeId)`, `orders updated (status)`; whether default type was created.
  - Prints structured JSON summary (includes `ok`, `results`, `when`, `durationMs`).
- Run:
  - `node scripts/migrations/2025-10-OrderType-backfill.js` (uses `MONGO_URI|MONGO_URL`).
- Notes:
  - If `default.startStatusId` is not set, status backfill is skipped (explicitly logged).
- `node scripts/migrations/2025-10-OrderType-backfill.js` (uses `MONGO_URI|MONGO_URL`).
- Notes:
  - If `default.startStatusId` is not set, status backfill is skipped (explicitly logged).

### API Contracts — OrderTypes (OpenAPI)
- Artifact: `storage/reports/api-contracts/ordertype.json`
- Source generator: `scripts/generateSwagger.js` (paths `/api/order-types`, `/api/order-types/{id}`; schemas `OrderType`, `OrderTypeItemResponse`, `OrderTypesListResponse`, `ErrorResponse`, `DeleteResponse`)
- Extraction script: `scripts/extractOrderTypeSpec.js` (выделяет подмножество контрактов OrderTypes из общего Swagger)
- Status: Completed
- Affected: `routes/orderTypes.js`, `scripts/generateSwagger.js`
- Error codes covered:
  - `400` — `ORDERTYPE_INVALID_START_STATUS`, `VALIDATION_ERROR`
  - `403` — Forbidden (RBAC)
  - `404` — Not Found (get by id)
  - `409` — `CODE_EXISTS` (POST/PATCH), `SYSTEM_TYPE`, `ORDERTYPE_IN_USE` (DELETE)
  - `500` — Server Error
- Request example (POST/PATCH):
  - `{"code":"default","name":"Default","startStatusId":"st_new","allowedStatuses":["st_new","st_in_progress"],"docTemplateIds":["doc_invoice","doc_contract"],"isSystem":true}`

## 14. RBAC — OrderTypes permissions (2025-10)
- Middleware: `middleware/auth.js` добавлены permission‑флаги `orderTypes.read` и `orderTypes.write` с маппингом на роль `Admin` (`RBAC_MAP`).
- API защита: `/api/order-types*` переведены на `requirePermission()`
  - `GET /api/order-types`, `GET /api/order-types/:id` → `orderTypes.read`.
  - `POST /api/order-types`, `PATCH /api/order-types/:id`, `DELETE /api/order-types/:id` → `orderTypes.write`.
- UI ограничения:
  - Меню «Настройки → Типы заказов» доступно только `Admin` (см. `client/src/components/Layout.js`).
  - Маршрут `settings/forms/order-types` защищён `ProtectedRoute roles={["Admin"]}` (см. `client/src/App.js`).
  - Страница «RBAC тест» показывает флаги: `orderTypes.read` / `orderTypes.write` и видимость маршрута (см. `client/src/pages/RbacTest.js`).
- DEV‑режим: при `AUTH_DEV_MODE=1` и отсутствии Mongo — in‑memory список типов; RBAC применяется на уровне роутов.
- Ошибки доступа: при отсутствии прав сервер отвечает `403` и `{ msg: 'Недостаточно прав' }`.

### Acceptance
- Пользователь с ролью `Manager` или без ролей:
  - не видит пункт меню «Типы заказов»;
  - не открывает страницу по прямой ссылке (маршрут защищён);
  - запросы `GET/POST/PATCH/DELETE /api/order-types*` возвращают `403` и `{ msg: 'Недостаточно прав' }`.
- Пользователь `Admin`:
  - видит пункт меню и страницу «Типы заказов»;
  - имеет доступ к чтению и модификации типов через API и UI.