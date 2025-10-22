import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as UiThemeProvider } from './context/ThemeContext';
import { ThemeModeProvider } from './context/ThemeModeContext';
import './assets/theme-overrides.css';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <UiThemeProvider>
        <ThemeModeProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
            <App />
          </LocalizationProvider>
        </ThemeModeProvider>
      </UiThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);