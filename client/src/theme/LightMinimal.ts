import type { Theme } from './index';

export const LightMinimal: Theme = {
  name: 'Light Minimal',
  colors: {
    primary: '#00baff',
    secondary: '#7c3aed',
    bg: '#f5f6f8',
    surface: '#ffffff',
    surfaceAlt: '#f9fafb',
    text: '#1f2937',
    textMuted: '#6b7280',
    border: '#e5e7eb',
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
  shadow: '0 6px 20px rgba(17,24,39,.06)',
  focusRing: '0 0 0 3px rgba(0,186,255,.25)',
};