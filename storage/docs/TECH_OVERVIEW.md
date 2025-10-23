# Character CRM — Technical Overview

## Архитектура и цели
- Monorepo без workspace: серверный код (Express + Mongo/Mongoose), клиент (React), вспомогательные скрипты, артефакты Swagger, отчеты.
- Цели: прозрачные контракты API, строгая валидация моделей и схем полей (FieldSchema), минимальный фреймворк-овербайт, воспроизводимые тесты и артефакты.

## Структура проекта
- `server.js` — точка входа Express; монтирует middleware аутентификации, маршруты API, и обработчик ошибок.
- `routes/` — REST API маршруты (клиенты, заказы, статусы, платежи, поля/схемы, словари и т.д.).
- `models/` — Mongoose модели и валидаторы.
- `services/` — бизнес-сервисы (кэш активных схем, провайдеры и т.д.).
- `scripts/` — скрипты генерации артефактов (Swagger, отчеты), миграции.
- `client/` — React клиент, сервисы API, страницы настроек и управления.
- `tests/` — Jest тесты: модели, e2e роутов, контрактные Swagger-проверки.
- `artifacts/` — сгенерированные файлы (OpenAPI `swagger.json` и др.).
- `storage/reports/` — отчеты по контрактам/миграциям.

## Основные модули
- Аутентификация и RBAC: `middleware/auth.js` — `requireAuth`, `withUser`, `requirePermission` (DEV fallback: `AUTH_DEV_MODE=1` → подставляет `req.user`).
  - RBAC карта (`RBAC_MAP`):
    - `orderTypes.read` → `Admin`
    - `orderTypes.write` → `Admin`
    - `uiTheme.read` → `Admin|Manager`
    - `uiTheme.write` → `Admin`
    - `payments.read` → `Admin|Finance`
    - `payments.write` → `Admin|Finance`
    - `payments.lock` → `Admin|Finance`
    - `cash.read` → `Admin|Finance`
    - `cash.write` → `Admin`
  - Роли:
    - `Admin` → доступ ко всем флагам выше
    - `Finance` → `payments.read|write|lock`, `cash.read`
  - Унификация Auth: ответы `{ ok:boolean }`; `login`/`refresh` возвращают `accessToken`/`refreshToken` и дубли `access`/`refresh` для совместимости.
  - UI: публичная страница `/bootstrap-first` (Первичная регистрация) с авто‑логином и редиректом на Дашборд.
- Валидация полей (FieldSpec): серверные валидаторы типов: `text`, `number`, `date`, `bool`, `list`, `multilist` (для `list/multilist` — `options` обязательны).
- FieldSchema: версионирование схем по паре `scope + name`, единственная активная версия, запрет удаления активной, активация/деактивация.
- Dicts: простые словари с уникальным `code`, значениями `values[]`, индексами и защитами.

## Тестирование
- Unit: валидаторы моделей/схем.
- e2e: DEV-ветки роутов (in-memory сторадж), RBAC (роль `Admin|Manager`), валидация ошибок.
- Контракты: Swagger `artifacts/swagger.json` сверяется тестами.

## Конфигурация
- ENV: `AUTH_DEV_MODE=1` (включает DEV-ветки и in-memory), `MONGO_URI` (в прод-режиме), `PORT`.

## Безопасность
- Запрет методов TRACE/TRACK.
- Глобальный `requireAuth` для `/api/*`, кроме `/api/auth/*` и `/api/public/*`.
- Swagger security: глобальный `security: [{ bearerAuth: [] }]` + на методах.

## Производительность
- Легкие маршруты, отсутствие тяжелых ORM-абстракций.
- Кэш активных FieldSchema с TTL (in-memory).
- Load/Perf: `tests/load/queues.cache.perf.test.js` — 10k смен статусов; отчёты `storage/reports/queue-load-report.md`, `storage/reports/perf-report.md`.
- TTL‑кэш: замеры hits/misses и времени списков для `GET /api/statuses` и `GET /api/doc-templates`.

## Скрипты
- `npm test` — запуски Jest.
- `node scripts/generateSwagger.js` — генерация OpenAPI в `artifacts/swagger.json`.
- `node scripts/extractOrderTypeSpec.js` — выделение подмножества OpenAPI для `/api/order-types` в `storage/reports/api-contracts/ordertype.json`.

## Test Runs
- Модели/валидаторы: `tests/models/fields.valid.test.js`, `tests/models/fields.invalid.test.js`.
- e2e: `tests/fields.schemas.e2e.test.js`, `tests/dicts.e2e.test.js`.
- Контракты Swagger: `tests/api.contracts.fields.dicts.swagger.test.js`.
- Payments — контракты: `tests/api.contracts.payments.test.js` (create/refund: `{ ok, id }`, требуется `orderId`; DEV/Mongo ветка возвращает stub `id`).
- Payments — RBAC e2e: `tests/payments.rbac.e2e.test.js` (GET/POST/PATCH/lock/refund, роли Admin/Finance/Manager/без ролей).
- Payments — правила блокировок: `tests/payments.lock.rules.e2e.test.js` (редактирование залоченного без `payments.lock` → 403).
- Payments — закрытие без оплаты: `tests/payments.locked.e2e.test.js` (`closeWithoutPayment` ⇒ `PAYMENTS_LOCKED` на create).
- Cash — контракты: `tests/api.contracts.cash.test.js` (list/get/create, валидные ответы).

## Changelog
- См. `CHANGELOG_TRAE.md` для детальной хронологии изменений.

## Статус проекта
- Базовые сущности, RBAC и контракты API сгенерированы.
- UI для управления схемами полей и словарями доступен в разделе Настройки.
- Модули: Payments — OK (MVP), Cash — OK.

## CI / VC
- Проверки линтеров и тестов перед мерджем.
- Генерация Swagger-артефакта и отчётов по контрактам.

## Data Sanity Checks
- Валидация входных данных в моделях и контроллерах.
- Логирование ошибок и 4xx/5xx ответов.
- Централизованная валидация запросов: `middleware/validate.js` (Joi) и общие схемы для Payments/Cash.
- Унифицированный формат ошибок: `{ ok: false, error, details? }` через глобальный хэндлер `middleware/error.js`.
- DEV‑ветка для Payments (create/refund): минимально требуется `orderId`; Mongo‑ветка возвращает stub `id` и проверяет ограничения по состоянию заказа.

### Health: FieldSchemas
- Единственная активная версия на пару `scope + name`; >1 → `problems.fieldSchemas.multiActiveForPair`.
- Наличие активной версии; 0 → `problems.fieldSchemas.noActiveForPair`.
- Уникальные номера версий внутри пары; дубли → `problems.fieldSchemas.duplicateVersionNumbers`.
- Номера версий — целые `>= 1`; нарушения → `problems.fieldSchemas.invalidVersionNumbers`.
- Для типов `list`/`multilist` обязательны непустые `options[]`; нарушения → `problems.fieldSchemas.invalidOptions`.
- Запуск отчёта: `node health/dataSanity.js` → JSON (`ok`, `summary.fieldSchemasCount`, `problems.fieldSchemas.*`).

### Health: Payments
- Проверки связности: `orderId` и `cashRegisterId` должны существовать; нарушения → `problems.payments.unknownOrderId|unknownCashRegisterId`.
- Инварианты данных: `type ∈ {income, expense, refund}`; `amount > 0`; `articlePath` — непустой массив; нарушения → `invalidType`, `nonPositiveAmount`, `emptyArticlePath`.
- Блокировки: если `locked=true`, должен быть `lockedAt`; нарушения → `lockedWithoutLockedAt`.
- Аудит: наличие `createdAt`; нарушения → `missingCreatedAt`.
- Инварианты заказов: для `closed.success=true` и для `paymentsLocked=true` — все платежи заказа должны быть `locked`; нарушения → `orderClosedSuccessHasUnlockedPayments`, `orderPaymentsLockedHasUnlockedPayments`.
- Сводка: `summary.paymentsCount` и агрегированное `summary.problemsTotal` учитывают блок `payments`.
- Индексы (рекомендовано): `Payment.index({ createdAt:1 })`, `{ type:1 }`, `{ orderId:1 }`, `{ cashRegisterId:1 }`, `{ locationId:1 }`, `{ articlePath:1 }`, `{ locked:1 }`, `{ lockedAt:1 }`, композитный `{ orderId:1, createdAt:-1 }`.
- Запуск: `node health/dataSanity.js` — не падает при отсутствии Mongo (печатает `mongoConnected:false`).

### Seeder: FieldSchemas
- Файл: `scripts/seedFieldSchemas.js`.
- Инициализирует пары: `orders/«Форма заказа»`, `clients/«Форма клиента»` базовыми полями.
- Если пары нет — создаёт `v1` (активная). Если активных 0 или >1 — нормализует: активной остаётся самая свежая версия, остальные деактивируются.
- Не перезаписывает существующие версии/поля, только инициализирует и исправляет активность.
- Запуск: `node scripts/seedFieldSchemas.js` (использует `MONGO_URI|MONGO_URL`).

## Миграции
- Скрипты миграций и импорта справочников и схем полей.

### Migration: Payments Backfill
- Файл: `scripts/migrations/2025-10-payments-backfill.js`.
- Назначение: нормализует `articlePath` (строка → массив строк), заполняет `locationId` при наличии `DEFAULT_LOCATION_ID`.
- Идемпотентность: повторные запуски безопасны (обновляются только нуждающиеся записи).
- Запуск: `node scripts/migrations/2025-10-payments-backfill.js`.
- ENV: `DEFAULT_LOCATION_ID` — укажите id локации для backfill `locationId`.

### Seeder: CashRegisters
- Файл: `scripts/seedCashRegisters.js`.
- Назначение: создаёт системную кассу `code=main`, `name="Основная касса"`, `isSystem=true`, `defaultForLocation=true`.
- Идемпотентность: использует `updateOne(..., { upsert: true })`; повторный запуск не создаёт дубликатов.
- Запуск: `node scripts/seedCashRegisters.js` (использует `MONGO_URI|MONGO_URL`).

## API артефакты и контракты

В проекте поддерживаются артефакты OpenAPI (Swagger), а также выделенные контракты для отдельных доменов.

- Генерация полного OpenAPI: `node scripts/generateSwagger.js` — пишет `artifacts/swagger.json`.
- Экстракция контрактов:
  - OrderType: `node scripts/extractOrderTypeSpec.js` — пишет `storage/reports/api-contracts/ordertype.json`.
  - Fields: `node scripts/extractFieldsSpec.js` — пишет `storage/reports/api-contracts/fields.json`.
  - Auth: `node scripts/extractAuthSpec.js` — пишет `storage/reports/api-contracts/auth.json`.

Правила и ожидания:
- Артефакты всегда должны соответствовать актуальному состоянию API.
- Перед публикацией контрактов, выполните генерацию полного `swagger.json`, затем — экстракцию нужных доменов.
- Для удаления сущностей используем унифицированный ответ `DeleteResponse` со схемой `{ ok: boolean }`.

Проверка:
- Автотесты для полей проверяют наличие схем и путей: `tests/api.contracts.fields.dicts.swagger.test.js`.
- В случае модификаций API необходимо обновить генератор и повторно выпустить артефакты.

## Client: Services & UI (FieldSchemas + Dicts)
- Services:
  - `client/src/services/fieldsService.js`: методы `list`, `get`, `listVersions(scope,name)`, `create`, `importSchema`, `patch`, `activate`, `deactivate`, `remove`.
  - `client/src/services/dictsService.js`: методы `list`, `get`, `getByCode(code)`, `create`, `update`, `remove`.
  - `client/src/services/paymentsService.js`: методы `list`, `create`, `update`, `lock`, `refund` (возвращают `response.data`; ошибки не перехватываются).
  - `client/src/services/cashService.js`: методы `list`, `create`, `update`, `remove` (возвращают `response.data`; ошибки не перехватываются).
  - `client/src/services/reportsService.js`: метод `cashflow(params)` — мини‑отчёт по кассам; возвращает `{ ok, groups[], balance }`.
- UI:
  - Полевая страница `client/src/pages/settings/FieldsBuilderPage.js` — импорт схем из локального хранилища, список версий (карточки), «Активировать» версию, ошибки/успехи, скрытие действий без ролей.
  - Справочники — базовые CRUD-страницы.

## Client: Payments UI
- Страница `client/src/pages/Payments.js` — реестр платежей, работающий поверх API.
- Фильтры: период (`dateFrom`/`dateTo`), тип (`income|expense|refund`), касса, заметка, мультиселект статей по древу (`articlePath[]`).
- Операции: создать платёж, редактировать, возврат (`refund`), блокировка (`lock`). Редактирование недоступно для `locked`; действие `lock` доступно только при роли `payments.lock`.
- RBAC: кнопки/действия скрываются при отсутствии ролей `payments.read|write|lock`. Загрузка данных и операции проверяют права.
- Totals: свод по `income/expense/refund/balance` из ответа `GET /api/payments`.
- Пустые состояния: «Нет платежей» и пустой свод по типам.
- Ошибки: унифицированные тосты (`Snackbar+Alert`), повтор запроса при временных ошибках не выполняется автоматически.
- Импорт статей: используется страница настроек `PaymentArticles.js` (локальное древо) для фильтрации по `articlePath`.

## Client: Reports — Cashflow
- Endpoint: `GET /api/reports/cashflow` — параметры: `dateFrom`, `dateTo`, опционально `locationId`.
- RBAC: доступ по `payments.read` (Admin|Finance); авторизация через глобальное middleware.
- Ответ: `{ ok:true, groups:[{ cashRegisterId, totals:{ income, expense, refund, balance } }], balance }`.
- DEV_MODE: агрегирование из in‑memory `services/devPaymentsStore.js` при недоступной Mongo.
- Клиент: `client/src/services/reportsService.js` (`cashflow(params)`); UI — виджет «Итоги по кассам» на странице `client/src/pages/Payments.js`.
- Acceptance: суммы по типам и общий баланс совпадают с данными платежей; пустые выборки показывают «Нет данных».

## Client: Orders — Виджет «Платежи заказа»
- В Orders (`client/src/pages/Orders.js`) отображается виджет платежей текущего заказа.
- Автозагрузка `orderPayments` по `orderId` при открытии редактора (`editOpen`) и смене текущего заказа.
- Быстрые операции: кнопки «Платёж» (income) и «Возврат» (refund) с модалкой; отправка через `paymentsService.create`/`paymentsService.refund`.
- Переход в реестр `/payments` с автоподстановкой фильтра `orderId`.
- Кнопка «Обновить» перезагружает список через `paymentsService.list({ orderId })`.
- Печать заказа: таблица платежей строится из `orderPayments` (статья, метод, чек, сотрудник, дата, сумма).
- Дефолтные статьи: доход `['Продажи','Касса']`, возврат `['Возвраты']`.

## FieldSchemas / Dicts — сервер
- Схемы:
  - `server/models/FieldSchema.js`: хранит версии, `scope`, `name`, `fields[]`, `note`, `version`, `isActive`, `createdBy`, `createdAt`.
  - `server/models/Dictionary.js`: поля `code` (уникальный, trim+lower), `values[]`, `updatedAt`; индекс `{code:1, unique:true}`; `pre('save')` трогает `updatedAt`.
- Тесты:
  - `tests/models/fields.valid.test.js`, `tests/models/fields.invalid.test.js` — валидные/невалидные кейсы; запуск: `npm test -- tests/models --runInBand`; результат: 2/2 PASSED.
- API / FieldSchemas:
  - `GET /api/fields` — список всех версий; сортировка scope/name, версия по убыванию.
  - `GET /api/fields/:id` — получить схему по id.
  - `GET /api/fields/:scope/:name/versions` — все версии пары scope+name.
  - `POST /api/fields` — создать новую версию: автоинкремент `version`, активирует новую (`isActive=true`) и деактивирует остальные версии пары.
  - `PATCH /api/fields/:id` — обновить `fields` и/или `note` (валидация: для `list`/`multilist` обязательны `options` → `400 FIELD_OPTIONS_REQUIRED`).
  - `POST /api/fields/:id/activate` — сделать версию активной (остальные той же пары деактивируются).
  - `POST /api/fields/:id/deactivate` — снять активность у версии.
  - `DELETE /api/fields/:id` — удаление запрещено для активной версии → `409 DELETE_ACTIVE_FORBIDDEN`.
  - Ошибки: `400 VALIDATION_ERROR|FIELD_OPTIONS_REQUIRED`, `404 NOT_FOUND`, `409 DELETE_ACTIVE_FORBIDDEN`.
  - RBAC: доступ `Admin` и `Manager`. DEV fallback: in‑memory при `AUTH_DEV_MODE=1` или недоступной Mongo.
- API / Dicts:
  - `GET /api/dicts` — список словарей.
  - `GET /api/dicts/:id` — получить по id.
  - `GET /api/dicts/by-code/:code` — получить по `code` (lowercase/trim).
  - `POST /api/dicts` — создать; уникальный `code` → конфликт `409 CODE_EXISTS`.
  - `PATCH /api/dicts/:id` — изменить `code` и/или `values`; `409 CODE_EXISTS` при конфликте кода.
  - `DELETE /api/dicts/:id` — удалить.
  - Ошибки: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 CODE_EXISTS`.
  - RBAC: доступ `Admin` и `Manager`. DEV fallback: in‑memory при `AUTH_DEV_MODE=1` или недоступной Mongo.
- Swagger / OpenAPI:
  - Добавлены схемы: `FieldSpec`, `FieldSchema`, `FieldSchemasListResponse`, `FieldSchemaItemResponse`, `FieldSchemaCreateRequest`, `FieldSchemaPatchRequest`, `Dictionary`, `DictionariesListResponse`, `DictionaryItemResponse`, `DictionaryCreateRequest`, `DictionaryPatchRequest`, `CashRegister`, `CashRegistersListResponse`, `CashRegisterItemResponse`, `Payment`, `PaymentsListResponse`, `PaymentItemResponse`, `PaymentCreateRequest`, `PaymentCreateResponse`, `PaymentRefundRequest`, `PaymentPatchRequest`.
  - Добавлены пути: `/api/fields`, `/api/fields/{id}`, `/api/fields/{scope}/{name}/versions`, `/api/fields/{id}/activate`, `/api/fields/{id}/deactivate`, `/api/dicts`, `/api/dicts/{id}`, `/api/dicts/by-code/{code}`, `/api/cash`, `/api/cash/{id}`, `/api/payments`, `/api/payments/refund`, `/api/payments/{id}`, `/api/payments/{id}/lock`.
  - Генератор: `scripts/generateSwagger.js`; артефакт: `artifacts/swagger.json`.
- Статус: Шаг 2 (API) — OK.

- API / Cash:
  - `GET /api/cash` — список касс; параметры `limit` (1..500, по умолчанию 50) и `offset` (>=0); сортировка по `code`.
  - `POST /api/cash` — создать кассу; обязательные поля `code`, `name`; нормализация `code` (trim+lower); конфликт кода → `409 CODE_EXISTS`.
  - `PATCH /api/cash/:id` — частичное обновление; запрет смены `code` для системной кассы (`isSystem=true`) → `409 SYSTEM_CODE_PROTECTED`; `409 CODE_EXISTS` при дублировании; `400 VALIDATION_ERROR`; `404 NOT_FOUND`.
  - `DELETE /api/cash/:id` — удалить; при наличии платежей → `409 CASH_IN_USE`; `404 NOT_FOUND`.
  - RBAC: `cash.read` → `Admin|Finance`; `cash.write` → `Admin`. DEV fallback: in‑memory при `AUTH_DEV_MODE=1` и недоступной Mongo (в DEV удаление без проверки платежей).

- API / Payments:
  - `GET /api/payments` — список платежей; параметры: `type (income|expense|refund)`, `orderId`, `cashRegisterId`, `locationId`, `dateFrom`, `dateTo`, `articlePath[]`, `limit` (1..500, по умолчанию 50), `offset` (>=0); сортировка по `createdAt` (desc). Ответ: `{ ok, items: Payment[], totals: { income, expense, refund, balance } }`.
  - `POST /api/payments` — создать платёж; минимально требуется `orderId`; доп. поля по бизнес‑логике: `amount`, `method`, `cashRegisterId`, `note`, `locationId`, `articlePath[]`; ответ `200` → `{ ok, id }`; ошибки: `400 VALIDATION_ERROR|PAYMENTS_LOCKED|ORDER_CLOSED`, `403 FORBIDDEN`, `404 NOT_FOUND`.
  - `POST /api/payments/refund` — создать возврат; минимально требуется `orderId`; ответ `200` → `{ ok, id }`; ошибки: `400 VALIDATION_ERROR|PAYMENTS_LOCKED|ORDER_CLOSED`, `403 FORBIDDEN`, `404 NOT_FOUND`.
  - `PATCH /api/payments/:id` — частичное обновление; ошибки: `400 VALIDATION_ERROR`, `400 PAYMENTS_LOCKED`, `400 ORDER_CLOSED`, `403 FORBIDDEN`, `404 NOT_FOUND`.
  - `POST /api/payments/:id/lock` — заблокировать платёж; ответ `200` → `PaymentItemResponse`; ошибки: `403 FORBIDDEN`, `404 NOT_FOUND`.
  - Ошибки домена: `PAYMENTS_LOCKED` — платёжные операции недоступны; `ORDER_CLOSED` — заказ закрыт; `VALIDATION_ERROR`; `NOT_FOUND`; DEV fallback: без проверки кассы (`CASH_NOT_FOUND` только в полной Mongo‑ветке).
  - RBAC: `payments.read` → `Admin|Finance`; `payments.write` → `Admin|Finance`; `payments.lock` → `Admin|Finance`.
  - Security: `bearerAuth`.
  - DEV fallback: при `AUTH_DEV_MODE=1` и недоступной Mongo — in‑memory; минимальная валидация: требуется `orderId`; ответы и ошибки соответствуют контрактным тестам.

### Использование FieldSchema в бизнес-логике
- `services/fieldSchemaProvider.js` — экспортирует `getActiveSchema(scope, name, ttlSecs=60)` с TTL-кэшем (in-memory) по ключу `active:<scope>:<name>`. Источник данных:
  - DEV (`AUTH_DEV_MODE=1`): in‑memory из `routes/fields.js`.
  - PROD: Mongo через `FieldSchemaModel`, индексы `{scope:1,name:1,version:-1}`.
- Заказ (Orders): `routes/orders.js` использует `validateOrderRequiredFields()` для `POST /api/orders` — находит активную схему `orders/«Форма заказа»`, валидирует обязательные поля (свойства `required`) внутри `body` и `body.fields`. Ошибка → `400 { error: 'REQUIRED_FIELDS_MISSING', missing: [...] }`.
- Клиент (Clients): `routes/clients.js` использует `validateRequiredFields()` для `POST /api/clients` и `PUT /api/clients/:id` — проверяет активную схему `clients/«Форма клиента»` для обязательных полей.
- TTL: по умолчанию 60 секунд на пару `scope+name` (ключ `active:<scope>:<name>`). Можно варьировать через параметр `ttlSecs` при вызове.
- Соответствие UI: `client/src/pages/settings/FieldsBuilderPage.js` → `storageKey` маппится на пары: `settings_order_fields → {scope:'orders', name:'Форма заказа'}`, `settings_client_fields → {scope:'clients', name:'Форма клиента'}`.

### Покрытие тестами API Fields/Dicts
- e2e: `tests/fields.schemas.e2e.test.js` — создание версий, список версий, GET по id, PATCH (note/валидация), activate/deactivate, запрет удаления активной версии (409), валидация list/multilist (`FIELD_OPTIONS_REQUIRED`).
- e2e: `tests/dicts.e2e.test.js` — список, создание, конфликт на дубль кода (409), GET по id и по коду, обновление, удаление.
- Swagger: `tests/api.contracts.fields.dicts.swagger.test.js` — проверка наличия схем (`FieldSchema`, `FieldSpec`, `Dictionary`, *Create/*Patch) и путей (`/api/fields*`, `/api/dicts*`), методы/ответы (200/403/409), security (`bearerAuth`).
- Режим: DEV (`AUTH_DEV_MODE=1`), in‑memory ветки роутов, без Mongo.
- Acceptance: покрытие достигнуто, тесты пройдены.

## UI/Theming
- Файлы и роли:
  - `client/src/context/ThemeContext.tsx` — провайдер UI-темы, `useUiTheme`, хранение `ui.theme`/`ui.accent`/`ui.accentHex` в `localStorage`, режим `Auto` (по `prefers-color-scheme`).
  - `client/src/theme/index.ts` — тип `Theme`, маппинг `themeToCssVars()` → CSS‑переменные, `applyThemeVars()` — инъекция стиля `#app-theme-vars` в `<head>` и атрибут `data-theme` на `<html>`.
  - `client/src/theme/CharacterDark.ts`, `client/src/theme/LightMinimal.ts` — пресеты тем.
  - `client/src/assets/theme-overrides.css` — переопределения MUI на базе CSS‑токенов + утилиты (классы).
  - `client/src/components/ThemeSwitcher.{tsx,jsx}` — переключатель темы в AppBar.
  - `client/src/components/Layout.js` — интеграция `ThemeSwitcher` в AppBar и пункт меню «Оформление» (`/settings/ui-theme`).
  - Rollback‑гайд темы (MUI): `docs/ui-theme-rollback.md`.
- Список токенов CSS:
  - Цвета: `--color-primary`, `--color-secondary`, `--color-bg`, `--color-surface`, `--color-surfaceAlt`, `--color-text`, `--color-textMuted`, `--color-border`, `--color-success`, `--color-danger`, `--color-warning`, `--color-info`.
  - Статусы: `--status-draft`, `--status-in-progress`, `--status-success`, `--status-fail`.
  - Типографика/радиусы/фокус: `--font-family`, `--font-size-base`, `--font-size-heading`, `--font-weight-bold`, `--radius`, `--shadow`, `--focus-ring`.
- Добавление новой темы:
  1) Создайте файл, например `client/src/theme/MyTheme.ts`, и экспортируйте `const MyTheme: Theme = { name, colors, font, radius, shadow, focusRing }`.
  2) Зарегистрируйте тему в `ThemeContext.tsx`: `import { MyTheme } from '../theme/MyTheme';` и добавьте в `THEMES`: `{ 'My Theme': MyTheme }`.
  3) Добавьте отображаемое имя в `availableThemes` (при необходимости). Режим `Auto` сам резолвит Dark/Light.
  4) Никаких правок CSS не требуется: `applyThemeVars()` инжектит переменные, а `theme-overrides.css` применяет их к UI.
- Акценты (accent):
  - Поддерживаются режимы `primary`/`secondary`/`custom` (цвет хранится в `ui.accent` и `ui.accentHex`). При смене акцента обновляется `--color-primary`.
- RBAC:
  - Страница «Оформление» — `/settings/ui-theme`, доступна `Admin` и `Manager`. Переключатель темы в AppBar доступен только `Admin`.

## Аутентификация: первичная регистрация
- Серверные эндпоинты:
  - `GET /api/auth/register-first` — проверка наличия пользователей; `{ ok:true, usersExist:false }` или `400 USERS_ALREADY_EXIST`.
  - `HEAD /api/auth/register-first` — статус без тела: `200` если регистрация возможна, `400` если пользователи уже есть.
  - `POST /api/auth/register-first` — создать первого администратора (email, пароль, имя); роль `Admin` гарантируется.
  - `POST /api/auth/bootstrap-admin` — совместимый с `register-first`; `201 Created`, `400 USERS_ALREADY_EXIST`; публичный (`security: []`).
  - `POST /api/auth/login` — `{ ok:true, accessToken, refreshToken, access, refresh }`.
  - `POST /api/auth/refresh` — `{ ok:true, accessToken, access }`.
- Swagger:
  - Коды ответов отражены: `201/400/401/403/500`.
  - Публичные эндпоинты `/api/auth/*` помечены `security: []` (глобальный `bearerAuth` переопределяется).
  - Обратная совместимость: дублируются поля `accessToken/access`, `refreshToken/refresh` в примерах и схемах.
- Клиент:
  - Страница `/bootstrap-first` публична, без авторизации; авто‑логин и переход на Дашборд после успешной регистрации.
  - На `/login` ссылка «Первичная регистрация» показывается, только если пользователей ещё нет (кэш `localStorage:first_user_allowed`).
  - Нотификации через `Snackbar`/`Alert` (стили в `client/src/assets/theme-overrides.css`).
- Безопасность:
  - Глобальный гард `/api/*` пропускает `/api/auth/*` и `/api/public/*`.
  - Пункт меню для `/bootstrap-first` не добавляется; доступ только по прямой ссылке.
- DEV режим:

### Аутентификация: мини-усиления безопасности и DX
- Rate-limit (DEV): по IP/учётке.
  - `login`: окно `60s`, лимит `AUTH_LOGIN_LIMIT` (по умолчанию `5`).
  - `refresh`: окно `60s`, лимит `AUTH_REFRESH_LIMIT` (по умолчанию `10`).
  - Ответ при бурсте: `429 { ok:false, error:'RATE_LIMIT', retryAfterMs }`.
- PROD: рекомендуем лимитировать через прокси/ingress (Nginx/Cloud LB). Встроенный лимитер — in‑memory, не для горизонтального скейлинга.
- TTL на refresh-токенах: `models/UserToken.js` содержит TTL‑индекс `expires_at` (`expireAfterSeconds:0`), просроченные записи удаляются MongoDB автоматически.
- Идентификатор сессии: `session_id` (uuid) добавлен в `UserToken` для точечной ревокации конкретной сессии.
- Массовая ревокация: `middleware/auth.js` экспортирует `revokeAll(userId)` — удаляет все refresh‑токены пользователя; используйте при сбросе пароля.
- ENV: `AUTH_LOGIN_LIMIT`, `AUTH_REFRESH_LIMIT` для настройки лимитов в DEV.

## Версия 3.4 — Payments (MVP) — Final (2025-10-22 13:40 CEST)
- Payments API: `GET /api/payments`, `POST /api/payments`, `POST /api/payments/refund`, `PATCH /api/payments/{id}`, `POST /api/payments/{id}/lock`.
- Ошибки: `PAYMENTS_LOCKED`/`ORDER_CLOSED` при создании/возврате для закрытых или заблокированных заказов; `PAYMENT_LOCKED` при попытке редактировать залоченный без права `payments.lock`; `CASH_NOT_FOUND` при неверной кассе.
- Totals: `GET /api/payments` возвращает свод по типам `{ income, expense, refund, balance }` и пустые состояния корректно.
- Cash: `DELETE /api/cash/{id}` запрещён при наличии связанных платежей → `409 CASH_IN_USE` (Mongo ветка).
- RBAC: `Admin|Finance` для `payments.read|write|lock`; `Admin` для `cash.write`; `Admin|Finance` для `cash.read`.
- Swagger/артефакты: обновлены схемы и пути для Payments/Cash; `artifacts/swagger.json` регенерирован.
- Клиент: реестр `Payments` (фильтры, totals, операции create/edit/refund/lock), виджет Cashflow, интеграция с `Orders` (виджет платежей заказа).
- DEV_MODE: in-memory стораджи для Payments и Cash, ответы соблюдают контракты.

### Acceptance
- `GET /api/payments` — 200, корректные totals, пустые выборки без ошибок.
- `POST /api/payments` — 200 + `{ ok:true, id }`; ограничения: `PAYMENTS_LOCKED|ORDER_CLOSED`.
- `PATCH /api/payments/{id}` — запрет смены `type`; 403 `PAYMENT_LOCKED` без `payments.lock`; `CASH_NOT_FOUND` при неверной кассе.
- `POST /api/payments/{id}/lock` — 200, выставляет `locked=true`, `lockedAt`.
- `POST /api/payments/refund` — 200 + `{ ok:true, id }`; ограничения по состоянию заказа аналогичны create.
- `GET /api/cash` — 200; `POST /api/cash` — 201; `PATCH /api/cash/{id}` — 200 с защитой `SYSTEM_CODE_PROTECTED`; `DELETE /api/cash/{id}` — 409 `CASH_IN_USE` при платежах (Mongo).