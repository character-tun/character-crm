import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// MUI theme factory for JS consumers
export function makeTheme(mode = 'light') {
  const tokens = {
    shape: { radius: 8 },
    palette: {
      primary: { main: '#1976d2' },
      secondary: { main: '#9c27b0' },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      error: { main: '#d32f2f' },
      grey: { 100:'#f5f5f5', 200:'#eeeeee', 300:'#e0e0e0', 900:'#212121' }
    }
  };

  return createTheme({
    palette: { mode, ...tokens.palette },
    shape: { borderRadius: tokens.shape.radius },
    typography: {
      fontFamily: '"Inter","Roboto","Helvetica","Arial",sans-serif',
      h6: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: mode === 'dark' ? '#0f1216' : '#fafafa' },
        },
      },
      MuiCard: {
        styleOverrides: { root: { boxShadow: 'var(--mui-shadow-2)' } },
      },
      MuiButton: {
        styleOverrides: { root: { textTransform: 'none', borderRadius: tokens.shape.radius } },
      },
      MuiAppBar: { defaultProps: { elevation: 0 } },
    },
  });
}

const baseTheme = createTheme({
  // Palette: keep existing defaults; do not change here
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiPaper: { defaultProps: { elevation: 1 } },
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
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: '1px solid',
          borderColor: theme.palette.divider,
        }),
      },
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
          backgroundColor: theme.palette.mode === 'dark' ? '#111418' : theme.palette.background.paper,
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& th': { fontWeight: 700 },
        },
      },
    },
    MuiChip: { defaultProps: { size: 'small' } },
  },
});

export const appTheme = responsiveFontSizes(baseTheme);

// CSS Vars bridge for runtime theming (keeps ThemeContext working)
export function themeToCssVars(theme) {
  const t = theme;
  const vars = {
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

export function applyThemeVars(theme) {
  if (typeof document === 'undefined') return; // SSR guard
  const html = document.documentElement;
  html.setAttribute('data-theme', theme.name);

  const vars = themeToCssVars(theme);
  const css = `:root{${Object.entries(vars).map(([k,v]) => `${k}:${v}`).join(';')}}`;

  let styleEl = document.getElementById('app-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'app-theme-vars';
    styleEl.type = 'text/css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

export default appTheme;