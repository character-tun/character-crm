# UI Preflight — аудит клиента перед темизацией MUI

Дата: 2025-10-22
Автор: TRAE Assistant

## 1) Глобальные стили (пути)
- `client/src/assets/theme-overrides.css` — импортируется в `client/src/index.js`
- `react-big-calendar/lib/css/react-big-calendar.css` — импортируется в `client/src/pages/Calendar.js` (глобальный CSS пакета)

Прочих глобальных `index.css`, `App.css`, `*.scss` в `client/src` не обнаружено.

## 2) Найденные UI-библиотеки (импорты)
- Material UI (MUI): `@mui/material`, `@mui/icons-material`, `@mui/x-data-grid`, `@mui/x-date-pickers`
  - Примеры: `client/src/App.js` (`ThemeProvider`, `CssBaseline`), компоненты и страницы по всему `client/src`
- Emotion: `@emotion/react`, `@emotion/styled` — базовый CSS-in-JS провайдер для MUI
- React Big Calendar: `react-big-calendar` — импорт CSS: `react-big-calendar/lib/css/react-big-calendar.css`
- Recharts: `recharts` — используется в `client/src/components/Chart.js`
- TinyMCE: `@tinymce/tinymce-react` — rich-text редактор
- Иконки: `lucide-react` — иконографика

Замечание: в `client/src/App.js` присутствуют маршруты `BootstrapFirst` и `BootstrapWizard`, но импорта `bootstrap`-CSS/JS в `client/src` нет; страницы, вероятно, демонстрационные.

## 3) Потенциальные конфликты
- `!important` в глобальном CSS:
  - `client/src/assets/theme-overrides.css`: строки с `!important` на кнопках, типографике и скруглениях (например, цвет `contained`-кнопок, muted-цвет текста, pill-скругления)
- Глобальный CSS сторонней библиотеки:
  - `react-big-calendar/lib/css/react-big-calendar.css` — содержит собственные базовые стили, может пересекаться по специфичности с MUI-классами на странице календаря
- Селекторы на внутренние классы MUI:
  - `theme-overrides.css` таргетит классы вида `.MuiPaper-root`, `.MuiAppBar-root`, `.MuiButton-root` и т. п. — это повышает риск непредсказуемости при обновлении MUI или переносе логики в тему
- Reset/normalize:
  - Явных `normalize.css`/`reset.css` импортов не найдено в `client/src`

Риски при темизации:
- Порядок инъекции стилей: глобальный CSS может перезаписывать MUI theme overrides, особенно с `!important`
- Обновления MUI: изменения внутренних названий классов могут сломать глобальные таргеты в `theme-overrides.css`

## 4) Рекомендации — что НЕ трогать при установке MUI-темы
- Не удалять и не переименовывать `client/src/assets/theme-overrides.css` на первом шаге — переноса хватит в рамках отдельной фазы
- Не выносить `react-big-calendar` CSS из страницы календаря; оставить импорт как есть и при необходимости локально переопределять через контейнер-обёртку
- Не заменять Emotion (`@emotion/react`, `@emotion/styled`) — MUI опирается на него; не переключать на `styled-components`
- Не трогать существующую структуру `ThemeProvider` и контекст `UiThemeProvider` — миграции проводить поверх них
- Не переписывать `@mui/x-data-grid`/`@mui/x-date-pickers` стили вручную — использовать theme overrides/slots, иначе можно сломать интерактивность
- Не добавлять глобальные reset/normalize до завершения темизации — это усложнит контроль специфичности
- Не вводить дополнительные `!important` — вместо этого повышать специфичность точечно или использовать `sx`/`styled` с темой

## Итог
- Основной глобальный стиль: `theme-overrides.css` + точечный импорт CSS `react-big-calendar`
- Библиотеки: MUI (+ MUI X), Emotion, Big Calendar, Recharts, TinyMCE, Lucide Icons
- Конфликты минимальны и локализованы; критичное — `!important` и таргетирование MUI-классов в глобальном CSS
- Рекомендуется плановый перенос overrides из CSS в MUI theme (palette, components, typography), без касания Big Calendar и без замены Emotion