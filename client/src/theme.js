import { createTheme, alpha, darken } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3B82F6' },
    secondary: { main: '#22D3EE' },
    success: { main: '#22C55E' },
    warning: { main: '#F59E0B' },
    error: { main: '#EF4444' },
    background: { default: '#0b1220', paper: '#0f172a' },
    text: { primary: '#E5E7EB', secondary: '#94A3B8' },
    divider: '#233042',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
    fontSize: 13,
    h4: { fontSize: '1.25rem', fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#0b1220' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: theme.palette.background.paper,
          border: '1px solid',
          borderColor: theme.palette.divider,
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          border: '1px solid',
          borderColor: theme.palette.divider,
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
        contained: { boxShadow: 'none' },
        outlined: { borderColor: '#233042' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: '#0b1422',
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.9) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
        }),
        input: { color: '#e5e7eb' },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: '#9aa4b2' } },
    },
    MuiSelect: {
      styleOverrides: { outlined: { backgroundColor: '#0b1422' } },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme, ownerState }) => {
          const map = {
            success: theme.palette.success.main,
            warning: theme.palette.warning.main,
            error: theme.palette.error.main,
            info: theme.palette.secondary.main,
            default: theme.palette.primary.main,
          };
          const color = map[ownerState.color || 'default'] || theme.palette.primary.main;
          const isOutlined = ownerState.variant === 'outlined';
          return isOutlined
            ? { borderColor: alpha(color, 0.6), color: alpha(color, 0.95), backgroundColor: alpha(color, 0.06), borderRadius: 8, fontWeight: 600 }
            : { backgroundColor: alpha(color, 0.28), color: '#fff', borderRadius: 8, fontWeight: 600 };
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }),
      },
    },
    MuiDivider: {
      styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) },
    },
    MuiSwitch: {
      styleOverrides: { track: { backgroundColor: '#233042' } },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          borderRight: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.default,
          boxShadow: 'none',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    // DataGrid styles: header, rows, hovers
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: '1px solid',
          borderColor: theme.palette.divider,
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
        }),
        columnHeaders: ({ theme }) => ({
          backgroundColor: darken(theme.palette.background.paper, 0.08),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          color: theme.palette.text.secondary,
          fontWeight: 600,
        }),
        columnHeader: ({ theme }) => ({
          color: theme.palette.text.secondary,
          fontWeight: 600,
          letterSpacing: 0.2,
        }),
        row: ({ theme }) => ({
          '&:nth-of-type(odd)': { backgroundColor: alpha(theme.palette.primary.main, 0.035) },
          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.085) },
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }),
        cell: ({ theme }) => ({
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }),
        footerContainer: ({ theme }) => ({
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          backgroundColor: darken(theme.palette.background.paper, 0.06),
        }),
      },
    },
    // Tables: zebra stripes and hover
    MuiTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& tbody tr:nth-of-type(odd)': { backgroundColor: alpha(theme.palette.primary.main, 0.035) },
          '& tbody tr:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.085) },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}` }),
        head: ({ theme }) => ({ backgroundColor: darken(theme.palette.background.paper, 0.08), color: theme.palette.text.secondary, fontWeight: 600 }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 8, '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) } }),
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: ({ theme }) => ({ backgroundColor: darken(theme.palette.background.paper, 0.1), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }),
      },
    },
  },
});

export default theme;