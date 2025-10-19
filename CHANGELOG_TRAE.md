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