import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as UiThemeProvider } from './context/ThemeContext';
import './assets/theme-overrides.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <UiThemeProvider>
        <App />
      </UiThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);