import { createTheme, alpha } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

// Brand tokens: Character ERP Cloud — зелёно-бирюзовые акценты
const brand = {
  primary: {
    light: '#34d399', // emerald-400
    main: '#10b981',  // emerald-500
    dark: '#0f766e',  // teal-700 (hover/darken)
    contrastText: '#0b1020',
  },
  secondary: {
    light: '#5eead4', // teal-300
    main: '#2dd4bf',  // teal-400
    dark: '#0e7490',  // cyan-700
    contrastText: '#0b1020',
  },
  success: { main: '#22c55e' },
  warning: { main: '#f59e0b' },
  error:   { main: '#ef4444' },
  info:    { main: '#0ea5b7' },
};

// Unified radius: 2xl ≈ 16px; Soft Shadow for минималистичный плоский стиль
export const shapeRadius = 16;
export const softShadow = '0 8px 24px rgba(2, 8, 20, 0.08), 0 2px 8px rgba(2, 8, 20, 0.06)';

// Palettes by mode
const lightPalette = {
  mode: 'light' as const,
  primary: brand.primary,
  secondary: brand.secondary,
  success: brand.success,
  warning: brand.warning,
  error: brand.error,
  info: brand.info,
  background: { default: '#f7f9fb', paper: '#ffffff' },
  text: { primary: '#0b1020', secondary: '#3b4758' },
  divider: '#e6e8eb',
};

const darkPalette = {
  mode: 'dark' as const,
  primary: brand.primary,
  secondary: brand.secondary,
  success: brand.success,
  warning: brand.warning,
  error: brand.error,
  info: brand.info,
  background: { default: '#0f1216', paper: '#111418' },
  text: { primary: '#e5eaf2', secondary: '#b1b9c7' },
  divider: '#1f2732',
};

// Core typography: Inter / Rubik
const typography: any = {
  fontFamily:
    '"Inter","Rubik", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  h1: { fontWeight: 700 },
  h2: { fontWeight: 700 },
  h3: { fontWeight: 700 },
  h4: { fontWeight: 700 },
  h5: { fontWeight: 700 },
  h6: { fontWeight: 600 },
  button: { textTransform: 'none', fontWeight: 600 },
};

// Component overrides: Button, Card, Table, FormField, Dialog, Stepper
const components: any = {
  MuiButton: {
    styleOverrides: {
      root: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        textTransform: 'none',
        '&.Mui-focusVisible': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
        },
      }),
      containedPrimary: ({ theme }: any) => ({
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        '&:hover': { backgroundColor: theme.palette.primary.dark },
      }),
    },
    defaultProps: { disableElevation: true },
  },
  MuiPaper: {
    defaultProps: { elevation: 1 },
    styleOverrides: {
      root: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        boxShadow: softShadow,
      }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        border: '1px solid',
        borderColor: theme.palette.divider,
        boxShadow: softShadow,
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        '& .MuiOutlinedInput-input': { padding: '12px 14px' },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }),
    },
  },
  MuiTextField: {
    defaultProps: { variant: 'outlined', size: 'medium' },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        boxShadow: softShadow,
      }),
    },
  },
  MuiStepper: {
    styleOverrides: {
      root: ({ theme }: any) => ({
        padding: theme.spacing(1),
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
  MuiDataGrid: {
    styleOverrides: {
      root: ({ theme }: any) => ({
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        '--DataGrid-rowBorderColor': theme.palette.divider,
      }),
      columnHeaders: ({ theme }: any) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.9)
            : theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
      row: ({ theme }: any) => ({ '&:hover': { backgroundColor: theme.palette.action.hover } }),
      cell: ({ theme }: any) => ({ borderColor: theme.palette.divider }),
      footerContainer: ({ theme }: any) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }),
      toolbarContainer: ({ theme }: any) => ({ borderBottom: `1px solid ${theme.palette.divider}` }),
    },
  },
};

// Factory: create Character ERP Cloud theme by mode
export function createCharacterTheme(mode: ThemeMode) {
  const palette = mode === 'dark' ? darkPalette : lightPalette;
  const componentsWithBaseline = {
    ...components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.default,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
  } as any;
  return createTheme({
    palette,
    shape: { borderRadius: shapeRadius },
    typography,
    components: componentsWithBaseline,
  } as any);
}

// Tenant-based branding: override primary/secondary and assets (logo, favicon)
export type TenantBrand = {
  name?: string;
  primaryHex?: string;
  secondaryHex?: string;
  logoUrl?: string;
  faviconUrl?: string;
};

export function createTenantTheme(tenant: TenantBrand | undefined, mode: ThemeMode) {
  const palette = mode === 'dark' ? { ...darkPalette } : { ...lightPalette };
  if (tenant?.primaryHex) {
    palette.primary = {
      ...palette.primary,
      main: tenant.primaryHex,
      dark: tenant.primaryHex,
      light: tenant.primaryHex,
    } as any;
  }
  if (tenant?.secondaryHex) {
    palette.secondary = {
      ...palette.secondary,
      main: tenant.secondaryHex,
      dark: tenant.secondaryHex,
      light: tenant.secondaryHex,
    } as any;
  }
  const componentsWithBaseline = {
    ...components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.default,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
  } as any;
  return createTheme({
    palette,
    shape: { borderRadius: shapeRadius },
    typography,
    components: componentsWithBaseline,
  } as any);
}

// Optional defaults for lucide-react usage
export const iconDefaults = { size: 20, strokeWidth: 1.8 };