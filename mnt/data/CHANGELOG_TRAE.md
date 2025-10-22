# CHANGELOG_TRAE

## 2025-10-22 — docs(ui): rollback guide for MUI theme

Ссылки:
- Rollback-гайд: `docs/ui-theme-rollback.md`

Acceptance:
- Ссылка корректна, документ открывается.
- Откат темы выполняется по инструкции.

---

## 2025-10-22 — feat(ui): внедрена MUI-тема с переключением режима

Ссылки:
- Rollback-гайд: `docs/ui-theme-rollback.md`
- Отчёт smoke-проверки: `storage/reports/ui-smoke-after-theme.md`

Создано/обновлено:
- `client/src/theme/tokens.ts` — базовые токены палитры и радиусы.
- `client/src/theme/index.ts` — `makeTheme(mode)` с палитрой, типографикой и overrides.
- `client/src/context/ThemeModeContext.tsx` — контекст режима (light/dark) с `localStorage`.
- `client/src/index.js` — обёртка `ThemeModeProvider` вокруг `App`.
- `client/src/App.js` — `ThemeProvider(makeTheme(mode))` + `CssBaseline`.
- `client/src/components/Layout.js` — переключатель темы (Sun/Moon).
- `client/src/theme/index.js` — JS-экспорт `makeTheme(mode)` для совместимости.

Acceptance:
- Приложение рендерится в обоих режимах, переключение работает.
- Базовые экраны читаемы, без визуально критичных регрессий.

---

## 2025-10-22 — fix(ui): post-theme minor adjustments

Ссылки:
- Отчёт: `storage/reports/ui-smoke-after-theme.md`
- Изменённые компоненты:
  - `client/src/components/Chart.js`
  - `client/src/components/Layout.js`
  - `client/src/pages/Login.js`

Кратко:
- Исправлен `XAxis dataKey` в графике дашборда: `day` → `name`.
- Контент-область получила `minHeight` и `overflow` для стабильной высоты/скролла.
- Локально нейтрализован жёлтый фон autofill на Login.

Acceptance:
- Все ключевые экраны открываются и читаемы.
- Нет визуально критичных регрессий.