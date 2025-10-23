import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as UiThemeProvider } from './context/ThemeContext';
import { ThemeModeProvider, useThemeMode } from './context/ThemeModeContext';
import './index.css';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './theme/index.ts';
import { NotifyProvider } from './components/NotifyProvider';

// Bridge component to read ThemeMode and provide dynamic MUI theme
function MuiThemeBridge({ children }) {
  const { mode } = useThemeMode();
  const theme = React.useMemo(() => createAppTheme(mode), [mode]);
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeModeProvider>
        <MuiThemeBridge>
          <UiThemeProvider>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <NotifyProvider>
                <App />
              </NotifyProvider>
            </LocalizationProvider>
          </UiThemeProvider>
        </MuiThemeBridge>
      </ThemeModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);