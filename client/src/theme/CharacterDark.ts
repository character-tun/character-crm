import type { Theme } from './index';

export const CharacterDark: Theme = {
  name: 'Character Dark',
  colors: {
    primary: '#00E59A',
    secondary: '#4AA3FF',
    bg: '#0E1116',
    surface: '#12161D',
    surfaceAlt: '#19202B',
    text: '#DBE2EA',
    textMuted: '#9AA6B2',
    border: '#232A36',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#38BDF8',
    status: {
      draft: '#6B7280',
      inProgress: '#4AA3FF',
      success: '#22C55E',
      fail: '#EF4444',
    },
  },
  font: {
    family: 'Inter, Roboto, system-ui, sans-serif',
    sizeBase: '15px',
    sizeHeading: '17px',
    weightBold: 600,
  },
  radius: '14px',
  shadow: '0 8px 24px rgba(0,0,0,.35)',
  focusRing: '0 0 0 3px rgba(0,229,154,.28)',
};