# UI‑Kit: Тема и правила использования (MUI v5)

Этот документ фиксирует единый подход к оформлению UI в проекте и дополняет общие правила из `docs/theme_master_prompt.md`.

- Библиотека: Material UI v5
- Источник темы: `client/src/theme/index.ts`, токены: `client/src/theme/tokens.ts`
- Переход светлая/тёмная: `ThemeModeContext` + `createAppTheme(mode)`

## Токены темы

Все визуальные значения берите из `theme` — через `sx` или функции коллбэка в `styled()`.

- palette: цвета компонентов и поверхностей
  - primary/secondary/success/warning/error
  - background: `default`, `paper`
  - text: `primary`/`secondary`/`disabled`
  - divider, action: `hover`, `selected`, `disabled`
- typography: семейство шрифтов и варианты
  - Семейство по умолчанию: `"Inter","Roboto","Helvetica","Arial",sans-serif`
  - Кнопки: `textTransform: none` (без UPPERCASE)
  - Заголовки: `h6` — `fontWeight: 600`
- spacing: базовая единица — 8px (`theme.spacing(1) === 8`)
  - В `sx` используйте числа: `p: 2` → 16px, `gap: 1.5` → 12px
- shape: скругление углов
  - `theme.shape.borderRadius` = `tokens.shape.radius` (по умолчанию 8)

Пример использования токенов:

```tsx
import { Box, Button, Typography } from '@mui/material';

export function TokenDemo() {
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      color: 'text.primary',
      border: 1,
      borderColor: 'divider',
      borderRadius: 1, // использует theme.shape.borderRadius
      p: 2, // 16px
    }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        Заголовок блока
      </Typography>
      <Button variant="contained" color="primary">Действие</Button>
    </Box>
  );
}
```

## Компонентные пресеты (components)
Переопределения и дефолты заданы в `client/src/theme/index.ts`:

- MuiCssBaseline: фон `body` зависит от `mode` (light/dark)
- MuiAppBar: `elevation=0`, цвет/бордер из палитры
- MuiPaper: `elevation=1`
- MuiCard: рамка `divider`, тень `var(--mui-shadow-2)`, радиус из темы
- MuiCardHeader: заголовок `subtitle1`, `fontWeight: 600`
- MuiButton: без uppercase, общий радиус, disabled‑состояния
- MuiTextField: `variant="outlined"`, `size="medium"`
- MuiInputBase/MuiOutlinedInput: высота поля 48px, плейсхолдеры, фокусы/hover из palette
- MuiListItemButton: скругление 8, `selected` подсвечивается через `action.selected`
- MuiDrawer: фон зависит от `mode`, без правой рамки
- MuiTabs/MuiTab: толще индикатор, без uppercase, `minHeight=48`
- MuiTable: жирные заголовки, hover на строках

Мини‑пример карточки с полем и кнопкой:

```tsx
import { Card, CardHeader, CardContent, Stack, TextField, Button } from '@mui/material';

export function PresetCard() {
  return (
    <Card>
      <CardHeader title="Форма" />
      <CardContent>
        <Stack spacing={2}>
          <TextField fullWidth label="Название" />
          <Button variant="contained">Сохранить</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

## Быстрые примеры

1) Формы: общий враппер `FormField` для подписей/подсказок/ошибок
```tsx
import FormField from 'components/FormField';
import { TextField } from '@mui/material';

export function UserForm() {
  return (
    <FormField label="Имя" hint="Укажите полное имя">
      <TextField id="name" placeholder="Иван Иванов" fullWidth />
    </FormField>
  );
}
```

2) Таблицы: единый `DataGridBase` с дефолтами RU
```tsx
import DataGridBase from 'components/DataGridBase';

const columns = [
  { field: 'id', headerName: 'ID', width: 120 },
  { field: 'name', headerName: 'Название', flex: 1 },
];
const rows = [{ id: 1, name: 'Пример' }];

export function TableDemo() {
  return (
    <div style={{ height: 360 }}>
      <DataGridBase rows={rows} columns={columns} />
    </div>
  );
}
```

3) Табы
```tsx
import { Tabs, Tab, Box } from '@mui/material';
import * as React from 'react';

export function TabsDemo() {
  const [value, setValue] = React.useState(0);
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value} onChange={(_, v) => setValue(v)}>
        <Tab label="Вкладка 1" />
        <Tab label="Вкладка 2" />
      </Tabs>
    </Box>
  );
}
```

4) Пример spacing и цвета через `sx`
```tsx
import { Box } from '@mui/material';

export function SpacingDemo() {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}> {/* 16px */}
      <Box sx={{ bgcolor: 'primary.main', width: 40, height: 40 }} />
      <Box sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }} />
    </Box>
  );
}
```

## Чек‑лист новой страницы
- Лейаут: используйте каркас AppShell (Header + Drawer уже подключены)
- Контейнер: `Box` с `maxWidth`, `mx: 'auto'`, горизонтальные `px: 2`
- Вертикальные отступы: `Stack spacing={2}` или `sx={{ my: 2 }}`
- Цвета/бордеры/тени: только через `theme` (`sx`), без хардкода
- Формы: `FormField + TextField/Select/DatePicker`, единые высоты полей (48)
- Таблицы: `DataGridBase` вместо прямого `DataGrid`
- Локализация: RU для пикеров/таблиц (уже настроено глобально)
- Skeleton: показывайте состояние загрузки, избегайте layout‑shift
- Брейкпоинты: проверка в `sm/md/lg/xl`

## Анти‑паттерны (и как правильно)

Плохо (хардкодит цвет и пиксели):
```tsx
<Box style={{ color: '#ff0000', padding: '16px' }}>…</Box>
```
Хорошо:
```tsx
<Box sx={{ color: 'error.main', p: 2 }}>…</Box>
```

Плохо (произвольный радиус, вне темы):
```tsx
<Card sx={{ borderRadius: '6px' }}>…</Card>
```
Хорошо:
```tsx
<Card sx={{ borderRadius: 1 }}>…</Card> {/* theme.shape.borderRadius */}
```

Плохо (обход пресетов):
```tsx
<DataGrid density="compact" />
```
Хорошо:
```tsx
<DataGridBase /> {/* Единые дефолты, RU‑локаль */}
```

Плохо (inline‑стили шрифтов):
```tsx
<div style={{ fontFamily: 'Arial' }}>Текст</div>
```
Хорошо:
```tsx
<Typography variant="body1">Текст</Typography>
```

## Линт и CI
Действует правило `no-hardcoded-ui` (см. `client/eslint-rules/no-hardcoded-ui.js`):
- Запрещены hex‑цвета (`#RGB/#RRGGBB`) и px‑единицы в UI‑коде
- Исключены SVG и inline‑иконки в JSX
- В CI правило включается как `error` для изменённых файлов `client/src/`

Проверка локально:
```
cd client
npx eslint src
```

## Где менять токены
- Цвета/серые/статусы: `client/src/theme/tokens.ts`
- Пресеты компонентов и типографика: `client/src/theme/index.ts`
- Доп. CSS‑переменные (опционально): `themeToCssVars/applyThemeVars` в `client/src/theme/index.ts`

---

Все примеры предназначены для прямого использования в страницах/компонентах проекта и соответствуют текущей теме MUI.