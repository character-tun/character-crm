# Character CRM / TRAE

CRM/ERP система для детейлинга, тюнинга и смежных сервисов.

- API: `Node.js + Express + MongoDB` (DEV допускает in‑memory ветки)
- UI: `React + MUI`
- Очередь статусов: обработка авто‑действий (идемпотентность, ретраи, метрики)
- Тесты: `Jest + Supertest` (unit/e2e/контракты), динамические пороги покрытия

## Возможности (UI, кратко)
- Авторизация и RBAC: вход/выход, авто‑рефреш токена; скрытие недоступных пунктов меню
- Задачи: доска/список, CRUD, перетаскивание между колонками
- Заказы: детали, статусы, задачи/платежи в заказе, печать по шаблону
- Платежи: приход/расход, итоги, фильтры по клиенту/заказу, экспорт CSV, печать чека
- Клиенты: список с атрибутами/тегами, переходы к заказам/платежам
- Услуги: древовидные категории и каталог; CRUD услуг (цены/себестоимость/гарантия)
- Настройки: пользователи/роли, шаблоны документов/уведомлений, статьи ДДС, типы/поля заказов и клиентов
- Инвентарь: заказы поставок и платежи поставщикам (прототип)
- DEV‑страницы: Bootstrap Wizard, RBAC Test

Полный перечень с примечаниями: см. TECH_OVERVIEW.md → «UI — возможности пользователя».

## Быстрый старт (DEV)
1) Установите зависимости сервера:
```
npm install
```
2) Установите зависимости клиента:
```
npm run install-client
```
3) Подготовьте окружение:
```
cp .env.example .env
# Для DEV оставьте AUTH_DEV_MODE=1
```
4) Запуск разработки:
```
# сервер + клиент
npm run dev
# или по отдельности
npm run server      # http://localhost:5002 (API)
npm run client      # http://localhost:3000 (UI)
```

## ENV (минимум для DEV/PROD)
- DEV (упрощённый): `AUTH_DEV_MODE=1`, `PRINT_DRY_RUN=1`, `NOTIFY_DRY_RUN=1`
- PROD (полный): `AUTH_DEV_MODE=0`, `MONGO_URI` или `MONGO_URL`, `JWT_SECRET`,
  `REDIS_URL` (или `REDIS_HOST|REDIS_PORT`), `CORS_ORIGIN`, `SMTP_*` по необходимости
- Валидатор ENV: `services/configValidator.js` — логирует понятные предупреждения

## Скрипты (root)
- `npm run dev` — сервер (nodemon) + клиент (CRA)
- `npm run server` — только сервер (`server.js`)
- `npm run client` — только клиент (`client/`)
- `npm run build` — сборка клиента (CRA)
- `npm test` — Jest (unit/e2e/контракты)
- `npm run test:cov` — Jest coverage + гейты (coverageThreshold).
- `npm run extract:payments` — экстракт payments → `storage/reports/api-contracts/payments.json`
- `npm run test:contracts` — регенерация артефактов + контракт‑тесты (`tests/api.contracts.*.test.js`)
- `npm run precontracts` — полная регенерация Swagger и экстрактов (auth/fields/ordertype/payments)

Полезные утилиты (node):
- `node scripts/generateSwagger.js` — обновить Swagger артефакт
- `node scripts/extractPaymentsSpec.js` — выделение OpenAPI подмножества payments → `storage/reports/api-contracts/payments.json`
- `node scripts/migrateOrderStatuses.js` — миграции статусов (CSV/JSON отчёты в `storage/reports/`)
- `node health/dataSanity.js` — проверка инвариантов данных (Mongo)
- `node scripts/seedCashRegisters.js` — создать системную кассу `code=main`
- `node scripts/migrations/2025-10-payments-backfill.js` — нормализация `articlePath`, заполнение `locationId` (env `DEFAULT_LOCATION_ID`)

### Сиды/миграции (запуск)
- Сид кассы: `node scripts/seedCashRegisters.js`
- Миграция платежей: `node scripts/migrations/2025-10-payments-backfill.js`
- Для заполнения `locationId` установите `DEFAULT_LOCATION_ID` в `.env` или переменных окружения.
- Оба скрипта идемпотентны: повторные прогоны безопасны.

## Тестирование и покрытие
- Запуск: `npm test`; покрытие/гейты: `npm run test:cov` — собирает покрытие и применяет гейты.
- Контракты: перед запуском контракт‑тестов используйте `npm run precontracts` или `npm run test:contracts`. В CI шаг `precontracts` выполняется автоматически перед Jest.
- Категории: `services`, `routes`, `queue`, `rbac`, `contracts`, `env`
- Гейты покрытия (Jest): линии 65%, стейтменты 65%, ветвления 50%, функции 55%.
- Реализация: `jest.config.js` → `coverageThreshold`; CI шаг «Coverage gates (Jest)» выполняет `npm run test:cov` и блокирует билд при недоборе.

## DEV‑страницы
- Bootstrap Wizard: `/bootstrap` — мастер создания администратора и сид базовых ролей
- RBAC Test: `/rbac-test` — интерактивная проверка доступов текущих ролей

## Документация
- Технический обзор: `TECH_OVERVIEW.md`
- История изменений: `CHANGELOG_TRAE.md`
- Отчёты/артефакты: `storage/reports/`
- Откат UI‑темы (MUI): `docs/ui-theme-rollback.md`

## Замечания по безопасности
- В DEV разрешены упрощения (in‑memory, dry‑run печати/уведомлений)
- В PROD включайте полный ENV и ограничивайте CORS; секреты не логируются

## Лицензия
—