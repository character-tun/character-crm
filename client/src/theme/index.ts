import { createTheme } from '@mui/material/styles';
import { tokens, ThemeMode } from './tokens';

export const makeTheme = (mode: ThemeMode) => createTheme({
  palette: { mode, ...tokens.palette },
  shape: { borderRadius: tokens.shape.radius },
  typography: {
    fontFamily: '"Inter","Roboto","Helvetica","Arial",sans-serif',
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mode === 'dark' ? '#0f1216' : '#fafafa',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'var(--mui-shadow-2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: tokens.shape.radius,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
    },
    MuiPaper: {
      defaultProps: { elevation: 1 },
    },
    MuiCardHeader: {
      defaultProps: {
        titleTypographyProps: { variant: 'subtitle1', fontWeight: 600 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          '&.Mui-selected': { backgroundColor: theme.palette.action.selected },
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRight: 0,
          backgroundColor:
            theme.palette.mode === 'dark' ? '#111418' : theme.palette.background.paper,
        }),
      },
    },
  },
});

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