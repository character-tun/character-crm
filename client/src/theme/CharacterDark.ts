import type { Theme } from './index';

export const CharacterDark: Theme = {
  name: 'Character Dark',
  colors: {
    primary: '#00ff88',
    secondary: '#00baff',
    bg: '#0f1115',
    surface: '#151821',
    surfaceAlt: '#1a1d22',
    text: '#e2e6eb',
    textMuted: '#9aa1ab',
    border: '#262a31',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#38bdf8',
    status: {
      draft: '#6b7280',
      inProgress: '#38bdf8',
      success: '#22c55e',
      fail: '#ef4444',
    },
  },
  font: {
    family: 'Inter, Roboto, system-ui, sans-serif',
    sizeBase: '14px',
    sizeHeading: '16px',
    weightBold: 600,
  },
  radius: '12px',
  shadow: '0 4px 16px rgba(0,0,0,.25)',
  focusRing: '0 0 0 3px rgba(0,255,136,.35)',
};