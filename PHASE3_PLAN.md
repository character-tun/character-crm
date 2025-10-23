PHASE 3 — «Паритет с HelloClient»
Версия документа: v1.0
Дата: 2025-10-24
Контекст: Фаза 3 направлена на достижение функционального паритета с HelloClient в области заказов, клиентов, платежей, уведомлений и документов.
Основная цель — к 20 ноября 2025 года сформировать MVP-комплект модулей Orders + Payments + Clients + Documents + Notifications, готовый к e2e-использованию в производственной среде (ERP Character Tuning → SAAS детейлингов).
🔰 Общие принципы реализации
Все изменения фиксируются в CHANGELOG_TRAE.md с датой и временем (локальной Europe/Warsaw).
После каждого этапа TRAE перегенерирует TECH_OVERVIEW.md, отражая статус модулей и актуальный функционал.
Каждый модуль выполняется сквозным циклом:
Модель → API → UI → RBAC → Очередь/Сервисы → Тесты → Документация.
Все новые маршруты описываются в Swagger (scripts/generateSwagger.js).
Очереди — BullMQ с Redis в PROD, in-memory в DEV.
Тест-чеклист обновляется в конце каждого этапа.
⚙️ Этап 3.3 — Payments MVP
Цель
Реализовать реальную модель платежей и касс в MongoDB с привязкой к заказам и статьям ДДС. Создать полноценный реестр доходов и расходов с фильтрацией, рефандами и ограничениями по ролям.
Область
Модели:
CashRegister { code, name, defaultForLocation?, cashierMode }
Payment { orderId?, type: income|expense|refund, articlePath[], amount, method, cashRegisterId, note, createdBy }
API: /api/payments/*, /api/cash/*
UI: client/src/pages/Payments.js — создание, редактирование, удаление, фильтры по датам, статьям, кассам.
Бизнес-правила:
Возврат (refund) оформляется как отрицательный приход или отдельная запись.
«Закрытые» платежи не редактируются (флаг locked + RBAC).
Системные статьи (из настроек) — read-only.
Acceptance Criteria
Создание и чтение платежей в MongoDB работает.
RBAC: только Finance и Admin могут создавать/редактировать.
Refund проводится корректно.
UI обновляется в реальном времени.
Тесты (payments.e2e.test.js) проходят на 100%.
После выполнения
Обновить TECH_OVERVIEW.md (Payments → OK) и добавить раздел в CHANGELOG_TRAE.md.
📬 Этап 3.4 — Notifications Center
Цель
Создать универсальный центр уведомлений с поддержкой SMTP и Telegram, возможностью назначения триггеров по статусам заказов и отправкой через очередь BullMQ.
Область
Модель: NotifyTemplate { channel, code, name, body, vars[] }
API: /api/notify/templates, /api/notify/send
Интеграции: абстрактные адаптеры /services/notify/adapters/{sms,email,telegram}.js.
Связка: таблица триггеров «статус → шаблон → канал».
ENV: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, TELEGRAM_BOT_TOKEN.
Очередь: BullMQ (notifyWorker.js), идемпотентность, ретраи.
Acceptance Criteria
Шаблоны CRUD доступны через UI.
Отправка e-mail и Telegram через очередь с логом.
При смене статуса заказа срабатывает триггер.
Dry-run (NOTIFY_DRY_RUN=1) работает в DEV.
После выполнения
Обновить TECH_OVERVIEW.md (Notifications → OK) и добавить раздел в CHANGELOG_TRAE.md.
📄 Этап 3.5 — Documents PDF Renderer
Цель
Реализовать редактор шаблонов документов (счёт, акт, квитанция) и сервис печати HTML → PDF с логотипом компании и переменными.
Область
Модель: DocTemplate { code, name, bodyHtml, variables[] }
Сервис: services/pdf/index.js на puppeteer/chromium.
UI: редактор в client/src/pages/settings/DocumentEditor.js с поддержкой переменных ({{order.id}}, {{client.name}}, {{company.logo}}).
Интеграция: добавить поля «логотип», «ИНН», «банк» в настройки компании.
Acceptance Criteria
CRUD шаблонов работает, переменные рендерятся.
Кнопка «Печать PDF» в карточке заказа генерирует файл.
PDF валиден в Adobe и браузере.
e2e тесты печати проходят.
После выполнения
Обновить TECH_OVERVIEW.md (Documents → OK) и CHANGELOG_TRAE.md.
📊 Этап 3.6 — Reports Framework
Цель
Ввести отчётность по движению денежных средств и прибыли заказов, с агрегацией по неделям и лоĸациям.
Область
API: /api/reports/cashflow, /api/reports/order-profit.
Сервисы: агрегация по периодам, кассам, статьям, лоĸациям.
UI: страницы client/src/pages/ReportsCashflow.js, ReportsProfit.js с таблицей и диаграммой.
Поля: дата платежа, статья, касса, приход, расход, итог по неделе.
Acceptance Criteria
ДДС и прибыль рассчитываются по реальным данным.
Фильтры по лоĸации и кассе работают.
График обновляется при изменении периода.
После выполнения
Обновить TECH_OVERVIEW.md (Reports → OK) и CHANGELOG_TRAE.md.
📥 Этап 3.7 — Import/Export Wizard
Цель
Добавить гибкий мастер импорта/экспорта данных (клиенты, товары, заказы) через CSV, с превью и валидацией.
Область
Модули: routes/import.js, client/pages/tools/ImportWizard.js.
Поддержка: CSV для клиентов, товаров, заказов.
Этапы: загрузка → превью → сопоставление → валидация → запись.
Файлы-примеры: /mnt/data/Аккаунт-2.csv, /Склад.csv, /Продукт-13.csv.
Acceptance Criteria
Импорт срабатывает без ошибок и сохраняет данные в Mongo.
Лог ошибок с ID строк и причинами пишется в storage/reports/import.log.json.
Экспорт в CSV работает по выбору раздела.
После выполнения
Обновить TECH_OVERVIEW.md (Import/Export → OK) и CHANGELOG_TRAE.md.
🏢 Этап 3.8 — Locations
Цель
Реализовать мульти-лоĸационную структуру: разделение данных по филиалам, свитчер в UI и ограничение доступа по ролям.
Область
Модель: Location { code, name, addresses[], phones[] }.
UI: client/components/LocationSwitcher.jsx в шапке.
RBAC: привязка пользователя к лоĸациям (в User или Employee.locations[]).
Фильтрация: все запросы по locationId.
Acceptance Criteria
Свитчер меняет активную лоĸацию.
Пользователь видит только данные своей лоĸации.
Платежи, склад, заказы изолированы.
После выполнения
Обновить TECH_OVERVIEW.md (Locations → OK) и CHANGELOG_TRAE.md.
👤 Этап 3.9 — Clients Module
Цель
Завершить модуль клиентов: карточки, поиск, связь с заказами и платежами, сегментация.
Область
Модель: Client { type: person|company, name, phones[], emails[], tags[], fields:{} }.
UI: список и карточка клиента (client/src/pages/clients/{List,Card}.js).
Бизнес-правила:
Проверка дубликатов по телефону/e-mail.
Быстрый поиск по части имени.
Теги и категории.
Acceptance Criteria
CRUD клиентов работает.
В карточке видны связанные заказы и платежи.
Поиск и фильтрация работают.
После выполнения
Обновить TECH_OVERVIEW.md (Clients → OK) и CHANGELOG_TRAE.md.
🛠️ Этап 3.10 — Infrastructure & Backups
Цель
Довести инфраструктуру до продакшн-готовности: BullMQ + Redis в очередях, автобэкапы Mongo, мониторинг и отчётность.
Область
Очереди: BullMQ (statusActionWorker.js, notifyWorker.js, pdfWorker.js).
Redis: использование REDIS_URL|HOST|PORT.
Бэкапы: скрипт scripts/backupMongo.js (ежедневно в 03:00).
Мониторинг: логирование очередей в storage/reports/queue-metrics.json.
Журналы: ошибки → Sentry или локальный storage/logs/.
Acceptance Criteria
Все очереди BullMQ в статусе OK.
Автоматический бэкап Mongo создаётся ежедневно.
Очереди возобновляются после рестарта.
queue-metrics.json обновляется автоматически.
После выполнения
Обновить TECH_OVERVIEW.md (Infra → OK) и CHANGELOG_TRAE.md.
🧾 Финальный результат Фазы 3
Модуль	Статус	Критерий завершения
Payments	✅ OK	CRUD, refund, RBAC Finance
Notifications	✅ OK	SMTP + Telegram + триггеры
Documents	✅ OK	PDF печать + редактор
Reports	✅ OK	ДДС и прибыль по неделям
Import/Export	✅ OK	CSV импорт и экспорт
Locations	✅ OK	Фильтрация по лоĸациям
Clients	✅ OK	Список, карточка, поиск
Infrastructure	✅ OK	Очереди + бэкапы + мониторинг
После успешного выполнения всех этапов TRAE обновляет:
TECH_OVERVIEW.md — все модули помечены OK, готовность ≈ 100 %.
CHANGELOG_TRAE.md — раздел «Фаза 3 (Паритет с HelloClient)» с датой и списком изменений.