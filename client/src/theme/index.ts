import { createTheme, alpha } from '@mui/material/styles';
import '@mui/x-data-grid/themeAugmentation';
import { ThemeMode } from './tokens';
import { createCharacterTheme } from './theme';

export const makeTheme = (mode: ThemeMode) => createCharacterTheme(mode);

export const createAppTheme = (mode: ThemeMode) => makeTheme(mode);

export type Theme = {
  name: string;
  colors: {
    primary: string; secondary: string;
    bg: string; surface: string; surfaceAlt: string;
    text: string; textMuted: string;
    border: string; success: string; danger: string; warning: string; info: string;
    status: { draft: string; inProgress: string; success: string; fail: string };
  };
  font: { family: string; sizeBase: string; sizeHeading: string; weightBold: number };
  radius: string;
  shadow: string;
  focusRing: string;
};

export function themeToCssVars(theme: Theme) {
  const t = theme;
  const vars: Record<string, string> = {
    '--color-primary': t.colors.primary,
    '--color-secondary': t.colors.secondary,
    '--color-bg': t.colors.bg,
    '--color-surface': t.colors.surface,
    '--color-surfaceAlt': t.colors.surfaceAlt,
    '--color-text': t.colors.text,
    '--color-textMuted': t.colors.textMuted,
    '--color-border': t.colors.border,
    '--color-success': t.colors.success,
    '--color-danger': t.colors.danger,
    '--color-warning': t.colors.warning,
    '--color-info': t.colors.info,

    '--status-draft': t.colors.status.draft,
    '--status-in-progress': t.colors.status.inProgress,
    '--status-success': t.colors.status.success,
    '--status-fail': t.colors.status.fail,

    '--radius': t.radius,
    '--shadow': t.shadow,
    '--focus-ring': t.focusRing,

    '--font-family': t.font.family,
    '--font-size-base': t.font.sizeBase,
    '--font-size-heading': t.font.sizeHeading,
    '--font-weight-bold': String(t.font.weightBold),
  };
  return vars;
}

export function applyThemeVars(theme: Theme) {
  if (typeof document === 'undefined') return; // SSR guard
  const html = document.documentElement;
  html.setAttribute('data-theme', theme.name);

  const vars = themeToCssVars(theme);
  const css = `:root{${Object.entries(vars).map(([k,v]) => `${k}:${v}`).join(';')}}`;

  let styleEl = document.getElementById('app-theme-vars') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'app-theme-vars';
    styleEl.type = 'text/css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' },
    background: { default: '#fafafa', paper: '#fff' },
  },
  typography: {
    fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
    button: { textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          textTransform: 'none',
          '&.Mui-disabled': { opacity: 0.48, pointerEvents: 'none' },
        }),
        containedPrimary: ({ theme }) => ({
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          '&:hover': { backgroundColor: theme.palette.primary.dark },
          '&.Mui-focusVisible': { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.3)}` },
          '&.Mui-disabled': {
            backgroundColor: theme.palette.action.disabledBackground,
            color: theme.palette.action.disabled,
          },
        }),
        outlinedPrimary: ({ theme }) => ({
          borderColor: theme.palette.primary.main,
          '&:hover': { borderColor: theme.palette.primary.dark },
          '&.Mui-focusVisible': { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}` },
        }),
        textPrimary: ({ theme }) => ({
          '&:hover': { backgroundColor: theme.palette.action.hover },
        }),
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRight: 0,
          backgroundColor: theme.palette.mode === 'dark' ? '#111418' : theme.palette.background.paper,
          borderRadius: 0,
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          minHeight: 48,
          '&.Mui-disabled': {
            backgroundColor: theme.palette.action.disabledBackground,
          },
        }),
        input: ({ theme }) => ({
          padding: '12px 14px',
          '&::placeholder': { color: theme.palette.text.disabled, opacity: 1 },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          '& .MuiOutlinedInput-input': { padding: '12px 14px' },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.action.disabled,
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          border: '1px solid',
          borderColor: theme.palette.divider,
          boxShadow: 'var(--mui-shadow-2)',
        }),
      },
    },
    MuiTabs: {
      defaultProps: { textColor: 'primary', indicatorColor: 'primary' },
      styleOverrides: {
        indicator: ({ theme }) => ({
          height: 3,
          borderRadius: 3,
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 48,
          textTransform: 'none',
          '&.Mui-selected': { color: theme.palette.primary.main },
          '&.Mui-focusVisible': {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
        }),
      },
    },
    MuiTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& thead th': { fontWeight: 700 },
          '& tbody tr:hover': { backgroundColor: theme.palette.action.hover },
        }),
      },
    },
    // Mirror DataGrid styles for the alternate theme object too
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          '--DataGrid-rowBorderColor': theme.palette.divider,
        }),
        columnHeaders: ({ theme }) => ({
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.9)
              : theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
        row: ({ theme }) => ({
          '&:hover': { backgroundColor: theme.palette.action.hover },
        }),
        cell: ({ theme }) => ({
          borderColor: theme.palette.divider,
        }),
        footerContainer: ({ theme }) => ({
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }),
        toolbarContainer: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  },
});
export default theme;