# UI Smoke-проверка после MUI-темы

Дата: 2025-10-22
Исполнитель: Trae AI

## Проверенные страницы
- Login
- Dashboard / Дашборд
- Orders
- Payments
- Settings

## Обнаруженные и исправленные моменты
1) Dashboard: пустые подписи по оси X на графике.
   - Причина: несовпадение ключа `dataKey` оси X (ожидался `name`, использовался `day`).
   - Правка: `client/src/components/Chart.js`, строка ~9
     - Было: `<XAxis dataKey="day" ... />`
     - Стало: `<XAxis dataKey="name" ... />`

2) Общий контент-область: высота/скролл местами давали ощущение «залипания» при длинном контенте.
   - Правка: `client/src/components/Layout.js`, строка ~272
     - Добавлено: `minHeight: 'calc(100vh - 70px)', overflow: 'auto'` в контейнер контента `<Box>`.

3) Login: жёлтый фон полей при автозаполнении (Chrome/Safari).
   - Причина: стандартный autofill стиль браузера конфликтовал с оформлением.
   - Правка: `client/src/pages/Login.js`, строки ~87–98
     - Добавлен локальный `<style>` с селектором `form[data-login] input:-webkit-autofill...` и атрибут `data-login="1"` у `<form>`.

## Статусы страниц
- Login — OK
- Dashboard — OK
- Orders — OK
- Payments — OK
- Settings — OK

## Примечания
- DEV вход: `admin@example.com / admin1234` (настроено в `.env`), поэтому попытка `admin@localhost` даёт `Invalid credentials`.
- Визуально критичных регрессий не обнаружено; все ключевые экраны открываются и читаемы.

## Acceptance
- Все ключевые экраны открываются и читаемы — выполнено.
- Нет визуально критичных регрессий — выполнено.