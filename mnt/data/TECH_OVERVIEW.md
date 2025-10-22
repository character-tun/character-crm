# TECH OVERVIEW — UI: Smoke-проверка после MUI-темы

Дата: 2025-10-22

Цель: убедиться, что ключевые экраны читаемы после применения MUI-темы, без визуально критичных регрессий.

Покрытие:
- Login
- Dashboard / Дашборд
- Orders
- Payments
- Settings

Итоговые минимальные правки:
- Chart (Dashboard): XAxis `dataKey` => `name` (исправлены подписи оси X).
- Layout: для контейнера контента добавлены `minHeight: calc(100vh - 70px)` и `overflow: auto`.
- Login: локальное правило для `input:-webkit-autofill` + атрибут `data-login` у формы — убран жёлтый фон автозаполнения.

Отчёт: `storage/reports/ui-smoke-after-theme.md`

Документация:
- Rollback-гайд (UI): `docs/ui-theme-rollback.md`
- Тема: базовые токены `client/src/theme/tokens.ts`, фабрика `client/src/theme/index.ts` → `makeTheme(mode)`, контекст `client/src/context/ThemeModeContext.tsx`, подключение в `client/src/index.js` (обёртка `ThemeModeProvider`) и `client/src/App.js` (`ThemeProvider(makeTheme(mode))` + `CssBaseline`), переключатель в `client/src/components/Layout.js`.

Acceptance:
- Все ключевые экраны открываются и читаемы — выполнено.
- Визуально критичных регрессий нет — выполнено.