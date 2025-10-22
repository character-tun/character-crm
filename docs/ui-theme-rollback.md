# UI Theme Rollback — MUI

Этот документ описывает три сценария:
- Временное отключение темы MUI (без удаления пакетов).
- Полное удаление темы MUI из проекта.
- Как повторно применить минимальные UI‑фиксы, если понадобятся.

Дата: 2025‑10‑22
Связано: TECH_OVERVIEW.md (UI/Theming), CHANGELOG_TRAE.md

---

## 1) Временно отключить тему (без удаления)
Цель: быстро проверить UI без MUI‑темы, оставив проект рабочим.

Шаги:
1. Откройте `client/src/App.js`.
2. Уберите обёртку `ThemeProvider` и компонент `CssBaseline`.

До:
```jsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appTheme } from './theme';

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>{/* ... */}</Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

После:
```jsx
function App() {
  return (
    <AuthProvider>
      <Routes>{/* ... */}</Routes>
    </AuthProvider>
  );
}
```

Опционально (если хочется полностью убрать визуальные токены):
- Удалите импорт `client/src/assets/theme-overrides.css` из `client/src/index.js`.
- Если используется `ThemeContext`/CSS‑переменные, временно отключите их подключение.

Проверка:
- Перезапустите клиент: `npm run client` (или `npm start` внутри `client`).
- Пройдите экраны: Login, Dashboard, Orders, Payments, Settings.

---

## 2) Полностью удалить тему MUI
Цель: убрать MUI‑тему и связанные пакеты из кода и зависимостей.

Важное предупреждение:
- Полное удаление MUI потребует замены MUI‑компонентов (кнопок, таблиц, форм) на альтернативы. Это не «быстрая операция»; оцените объём.

Шаги:
1. В `client/src/App.js` удалите импорт `ThemeProvider`, `CssBaseline` и `appTheme`, а также их использование (см. раздел 1).
2. Удалите директорию `client/src/theme` (все файлы темы).
3. Удалите импорт `client/src/assets/theme-overrides.css` (если есть) и сам файл, если он больше не нужен.
4. В каталоге `client/` выполните удаление пакетов:
```
npm uninstall @mui/material @mui/icons-material @mui/x-data-grid @mui/x-date-pickers @emotion/react @emotion/styled
```
5. Найдите оставшиеся импорты MUI в коде:
```
grep -R "@mui/material" client/src | wc -l
grep -R "@mui/icons-material" client/src | wc -l
grep -R "@mui/x-" client/src | wc -l
```
Замените их на альтернативные компоненты (или базовые HTML/CSS), по мере необходимости.

Проверка:
- Установите и запустите клиент: `npm install && npm run client`.
- Исправьте ошибки сборки, связанные с отсутствием MUI‑компонентов.

Откат удаления (если передумаете):
```
npm install @mui/material @mui/icons-material @mui/x-data-grid @mui/x-date-pickers @emotion/react @emotion/styled
```
Верните `client/src/theme` и `ThemeProvider`/`CssBaseline` в `App.js`.

---

## 3) Минимальные фиксы (перечень и как вернуть)
При темизации были применены точечные исправления, которые полезны и без MUI‑темы.
Если после отключения/удаления темы UI выглядит хуже, верните эти фиксы.

- Dashboard — читаемость оси X (Recharts):
  - Файл: `client/src/components/Chart.js`
  - Суть: использовать корректный `dataKey` (например, `name`) для `XAxis`, чтобы подписи совпадали с данными.
  - Пример:
    ```jsx
    import { XAxis } from 'recharts';
    // ...
    <XAxis dataKey="name" />
    ```

- Layout — высота и прокрутка контента:
  - Файл: `client/src/components/Layout.js`
  - Суть: задать минимальную высоту и явную прокрутку для главного контейнера контента, чтобы страницы не «обрезались».
  - Пример (sx):
    ```jsx
    <Container sx={{ minHeight: 'calc(100vh - 64px)', overflow: 'auto', mt: 2 }}>
      {children}
    </Container>
    ```
    При другой высоте AppBar скорректируйте число `64`.

- Login — желтый фон авто‑заполнения (Chrome/WebKit):
  - Файл: `client/src/pages/Login.js`
  - Вариант A (CSS): добавить глобальные стили
    ```css
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-text-fill-color: inherit;
      transition: background-color 9999s ease-in-out 0s;
    }
    ```
  - Вариант B (компонент): на поля логина добавить inline‑style
    ```jsx
    const autofillFix = {
      WebkitTextFillColor: 'inherit',
      transition: 'background-color 9999s ease-in-out 0s'
    };
    <TextField inputProps={{ style: autofillFix, 'data-login': '1' }} /* ... */ />
    ```

Проверка фиксов:
- Откройте Login/Dashboard и убедитесь, что подписи графиков читаемы, контент скроллится, а авто‑заполнение не «желтит» фон.

---

## FAQ
- Можно отключать только `CssBaseline`? Да, но визуальные различия будут меньше; для чистого сравнения убирайте и `ThemeProvider`.
- Нужно ли трогать `ThemeContext`? Только если используете CSS‑переменные темы; для «быстрого» отключения MUI‑темы это необязательно.
- Что сломается при полном удалении MUI? Все места, где используются компоненты MUI (`Box`, `Button`, `Table`, `Dialog`, и т.д.). Планируйте замену заранее.

## Ссылки
- `TECH_OVERVIEW.md` — раздел «UI/Theming».
- `CHANGELOG_TRAE.md` — записи о темизации и фикcах.