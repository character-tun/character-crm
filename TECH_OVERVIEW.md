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
- Аутентификация и RBAC: `middleware/auth.js` — `requireAuth` и `withUser` (DEV fallback: `AUTH_DEV_MODE=1` → подставляет `req.user`).
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

## Скрипты
- `npm test` — запуски Jest.
- `node scripts/generateSwagger.js` — генерация OpenAPI в `artifacts/swagger.json`.
- `node scripts/extractOrderTypeSpec.js` — выделение подмножества OpenAPI для `/api/order-types` в `storage/reports/api-contracts/ordertype.json`.

## Test Runs
- Модели/валидаторы: `tests/models/fields.valid.test.js`, `tests/models/fields.invalid.test.js`.
- e2e: `tests/fields.schemas.e2e.test.js`, `tests/dicts.e2e.test.js`.
- Контракты Swagger: `tests/api.contracts.fields.dicts.swagger.test.js`.

## Changelog
- См. `CHANGELOG_TRAE.md` для детальной хронологии изменений.

## Статус проекта
- Базовые сущности, RBAC и контракты API сгенерированы.
- UI для управления схемами полей и словарями доступен в разделе Настройки.

## CI / VC
- Проверки линтеров и тестов перед мерджем.
- Генерация Swagger-артефакта и отчётов по контрактам.

## Data Sanity Checks
- Валидация входных данных в моделях и контроллерах.
- Логирование ошибок и 4xx/5xx ответов.

### Health: FieldSchemas
- Единственная активная версия на пару `scope + name`; >1 → `problems.fieldSchemas.multiActiveForPair`.
- Наличие активной версии; 0 → `problems.fieldSchemas.noActiveForPair`.
- Уникальные номера версий внутри пары; дубли → `problems.fieldSchemas.duplicateVersionNumbers`.
- Номера версий — целые `>= 1`; нарушения → `problems.fieldSchemas.invalidVersionNumbers`.
- Для типов `list`/`multilist` обязательны непустые `options[]`; нарушения → `problems.fieldSchemas.invalidOptions`.
- Запуск отчёта: `node health/dataSanity.js` → JSON (`ok`, `summary.fieldSchemasCount`, `problems.fieldSchemas.*`).

### Seeder: FieldSchemas
- Файл: `scripts/seedFieldSchemas.js`.
- Инициализирует пары: `orders/«Форма заказа»`, `clients/«Форма клиента»` базовыми полями.
- Если пары нет — создаёт `v1` (активная). Если активных 0 или >1 — нормализует: активной остаётся самая свежая версия, остальные деактивируются.
- Не перезаписывает существующие версии/поля, только инициализирует и исправляет активность.
- Запуск: `node scripts/seedFieldSchemas.js` (использует `MONGO_URI|MONGO_URL`).

## Миграции
- Скрипты миграций и импорта справочников и схем полей.

## API артефакты и контракты

В проекте поддерживаются артефакты OpenAPI (Swagger), а также выделенные контракты для отдельных доменов.

- Генерация полного OpenAPI: `node scripts/generateSwagger.js` — пишет `artifacts/swagger.json`.
- Экстракция контрактов:
  - OrderType: `node scripts/extractOrderTypeSpec.js` — пишет `storage/reports/api-contracts/ordertype.json`.
  - Fields: `node scripts/extractFieldsSpec.js` — пишет `storage/reports/api-contracts/fields.json`.

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
- UI:
  - Полевая страница `client/src/pages/settings/FieldsBuilderPage.js` — импорт схем из локального хранилища, список версий (карточки), «Активировать» версию, ошибки/успехи, скрытие действий без ролей.
  - Справочники — базовые CRUD-страницы.

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
  - Добавлены схемы: `FieldSpec`, `FieldSchema`, `FieldSchemasListResponse`, `FieldSchemaItemResponse`, `FieldSchemaCreateRequest`, `FieldSchemaPatchRequest`, `Dictionary`, `DictionariesListResponse`, `DictionaryItemResponse`, `DictionaryCreateRequest`, `DictionaryPatchRequest`.
  - Добавлены пути: `/api/fields`, `/api/fields/{id}`, `/api/fields/{scope}/{name}/versions`, `/api/fields/{id}/activate`, `/api/fields/{id}/deactivate`, `/api/dicts`, `/api/dicts/{id}`, `/api/dicts/by-code/{code}`.
  - Генератор: `scripts/generateSwagger.js`; артефакт: `artifacts/swagger.json`.
- Статус: Шаг 2 (API) — OK.

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