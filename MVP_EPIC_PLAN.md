# MVP Epic Plan — Orders + Clients + Catalog + Payments

## Глобальная цель (спринт до 20.11.2025)
Сквозной поток: создать заказ на детали/услуги → выбрать клиента или создать его инлайн → добавить позиции из каталога или создать их инлайн → принять/отразить платеж(и) → видеть сальдо по заказу и историю статусов/оплат.
Опираемся на существующие модули: Статусы/Типы заказов, Конструктор полей, Статьи ДДС, RBAC, таймлайн статусов. :contentReference[oaicite:0]{index=0}

## Принципы выполнения
1) Каждая задача: модель → API → UI → RBAC → тесты → документация.  
2) После КАЖДОЙ задачи — запись в `CHANGELOG_TRAE.md` (таймзона Europe/Warsaw) + обновление `TECH_OVERVIEW.md`. Формат записи см. ниже. 
3) Валидации/инварианты: startStatusId ∈ allowedStatuses, переходы статусов только из allowed, неизменяемость «закрытых» платежей (refund отдельной записью). 
4) Инлайн-создание в заказе: Клиент и Номенклатура (товар/услуга). Снапшот названия/цены в позицию заказа на момент создания. :contentReference[oaicite:3]{index=3}
5) Производительность/надёжность: индексы по clientId/orderId/ts, очереди BullMQ для автодействий статусов, идемпотентность. 

## Эпики и контуры
A. Клиенты (инлайн + CRUD) — Client { type, name, phones[], emails[], tags[], fields:{} }; поиск + дедуп по телефону/e-mail. :contentReference[oaicite:5]{index=5}  
B. Номенклатура — Item { sku, name, type: good|service, price, uom, brand, group, attributes }. Без склада в этом MVP. :contentReference[oaicite:6]{index=6}  
C. Заказы — Order { orderTypeId, clientId, items[], totals, status, paymentsLocked? }. Таймлайн статусов и allowedStatuses. :contentReference[oaicite:7]{index=7}  
D. Платежи — CashRegister, Payment { orderId?, type: income|expense|refund, articlePath[], amount, method, cashRegisterId, note, createdBy }. Гварды: refund отдельной записью; запрет правок «закрытых». :contentReference[oaicite:8]{index=8}  
E. RBAC/Аудит/TTL-кэш — права на новые роуты; события платежей добавляются в таймлайн; TTL для справочников. :contentReference[oaicite:9]{index=9}

## Мини-контракты API
- POST /api/clients { name, type, phones[], emails[] } → { id } — использовать в инлайн-диалоге заказа. :contentReference[oaicite:10]{index=10}
- POST /api/items { name, type, price, uom } → { id } — инлайн в строке позиций. :contentReference[oaicite:11]{index=11}
- POST /api/orders { orderTypeId, clientId, items:[ { itemId|newItem{...}, qty, price? } ] } → { id, status, totals }. Стартовый статус из типа. :contentReference[oaicite:12]{index=12}
- POST /api/payments { orderId, type, articlePath[], amount, method, cashRegisterId, note } → { id }. Сальдо заказа пересчитывается. :contentReference[oaicite:13]{index=13}

## Definition of Done (для каждого шага)
- Модель/схема + индексы, API с RBAC, базовые e2e/контрактные тесты, UI-форма/диалог, обновлённый Swagger, CHANGELOG (с Acceptance), TECH_OVERVIEW обновлён. :contentReference[oaicite:14]{index=14}

## Формат записи в CHANGELOG_TRAE.md (пример)
2025-10-22T23:00:00+03:00 (Europe/Moscow) | <файлы/пути>
- feat(<модуль>): кратко, что сделано.
- docs: что обновлено в TECH_OVERVIEW/Swagger.
- tests: что покрыто.

### Acceptance
- 3–5 пунктов проверки (UI/API/RBAC/валидации/таймлайн).
