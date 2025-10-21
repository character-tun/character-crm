# Release 3.2 — OrderTypes (финал)

Дата/время (Europe/Warsaw): 2025-10-20T21:22:00+02:00
Тег: release-2025-10-20-3.2-OrderTypes
Коммит: 07d5838 — https://github.com/character-tun/character-crm/commit/07d5838

## Краткое описание
Завершён раздел 3.2: OrderTypes. Добавлены серверные маршруты и модель, клиентские сервисы и страницы, обновлены документы, миграции и тесты. Введены ограничения UI/RBAC: CRUD над типами заказов доступен только для Admin. Связали OrderType с начальным/допустимыми статусами заказа и шаблонами печати.

## Основные изменения
- Документация
  - Обновлён `TECH_OVERVIEW.md`: статус модуля OrderTypes = OK; убрано из «Следующие этапы»; уточнён UI-блок (CRUD только Admin; влияние на статусы/печать).
  - Добавлен подробный раздел в `CHANGELOG_TRAE.md`: «3.2 — OrderTypes (финал)» с подзадачами, файлами, схемой, чеклистом и акцептом.
  - Экспортирован `storage/reports/TECH_OVERVIEW.md`.
- Backend
  - Маршруты: `routes/orderTypes.js`.
  - Модель: `server/models/OrderType.js`.
  - Миграция/сид: `scripts/migrations/2025-10-OrderType-backfill.js`, `scripts/seedOrderTypes.js`.
  - Сервисы и контракты: актуализация `contracts/apiContracts.js`, интеграция с очередью статусов.
- Frontend
  - Сервисы и страницы для OrderTypes в `client/src/services` и `client/src/pages`.
  - RBAC: доступ CRUD только Admin; маршрут `/settings/forms/order-types`.
- Тесты
  - Добавлены/обновлены тесты: `tests/orderTypes.*`, контрактные и e2e.

## Схема и миграции
- Версия схемы: 2025-10 (OrderType backfill)
- Скрипты:
  - `scripts/migrations/2025-10-OrderType-backfill.js`
  - `scripts/seedOrderTypes.js`
  - `scripts/migrateOrderStatuses.js` (актуализированная логика)

## Подзадачи
- Модель и CRUD API для OrderType
- Привязка OrderType к заказам и начальным/разрешённым статусам
- Интеграция печатных форм по шаблонам на уровне OrderType
- UI: список, создание/редактирование, удаление (Admin only)
- RBAC и валидация контрактов
- Документация и CHANGELOG

## Чеклист тестирования (краткий)
- API-контракты OrderTypes: CRUD маршруты возвращают ожидаемые схемы
- E2E: сценарии создания/редактирования/удаления типов c правами Admin
- Ограничения для не-Admin (403/скрытие UI)
- Печатные формы привязаны к шаблонам OrderType
- Очередь статус-действий не ломается на разных OrderType

## Акцепт
- TECH_OVERVIEW и CHANGELOG обновлены, статус задачи 3.2 — OK
- Тестовый прогон локально зелёный на затронутых модулях
- Тег создан и доступен на GitHub; release отмечен как draft

## Ссылки
- `TECH_OVERVIEW.md`
- `CHANGELOG_TRAE.md` (секция «3.2 — OrderTypes (финал)»)
- `routes/orderTypes.js`
- `server/models/OrderType.js`
- `client/src/services/*`, `client/src/pages/*`
- `tests/orderTypes.*`