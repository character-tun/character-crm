import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { applyThemeVars, type Theme } from '../theme/index';
import { CharacterDark } from '../theme/CharacterDark';
import { LightMinimal } from '../theme/LightMinimal';

export type ThemeContextValue = {
  theme: Theme;
  themeName: string;
  setTheme: (name: string) => void;
  availableThemes: string[];
  accentMode: 'primary' | 'secondary' | 'custom';
  accentHex?: string;
  setAccentMode: (mode: 'primary' | 'secondary' | 'custom') => void;
  setAccentHex: (hex: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEMES: Record<string, Theme> = {
  'Character Dark': CharacterDark,
  'Light Minimal': LightMinimal,
};

function getPreferredThemeName(): string {
  const saved = localStorage.getItem('ui.theme');
  if (saved === 'Auto') return 'Auto';
  if (saved && THEMES[saved]) return saved;
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'Character Dark' : 'Light Minimal';
}

function resolveThemeName(name: string): string {
  if (name === 'Auto') {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'Character Dark' : 'Light Minimal';
  }
  return THEMES[name] ? name : 'Character Dark';
}

function getPreferredAccentMode(): 'primary' | 'secondary' | 'custom' {
  const saved = localStorage.getItem('ui.accent');
  return saved === 'secondary' ? 'secondary' : saved === 'custom' ? 'custom' : 'primary';
}
function getPreferredAccentHex(): string {
  return localStorage.getItem('ui.accentHex') || '#3B82F6';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<string>(getPreferredThemeName());
  const [accentMode, setAccentModeState] = useState<'primary' | 'secondary' | 'custom'>(getPreferredAccentMode());
  const [accentHex, setAccentHexState] = useState<string>(getPreferredAccentHex());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false);

  useEffect(() => {
    if (themeName === 'Auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
      try { mql.addEventListener('change', handler); } catch { /* Safari */ mql.addListener(handler); }
      return () => { try { mql.removeEventListener('change', handler); } catch { mql.removeListener(handler); } };
    }
  }, [themeName]);

  useEffect(() => {
    const resolved = resolveThemeName(themeName);
    const t = THEMES[resolved] || CharacterDark;
    applyThemeVars(t);
    try {
      let value = t.colors.primary;
      if (accentMode === 'secondary') value = t.colors.secondary;
      else if (accentMode === 'custom') value = accentHex;
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--color-primary', value);
      }
    } catch {}
  }, [themeName, accentMode, accentHex, systemPrefersDark]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: THEMES[resolveThemeName(themeName)] || CharacterDark,
    themeName,
    setTheme: (name: string) => {
      const next = name === 'Auto' ? 'Auto' : (THEMES[name] ? name : 'Character Dark');
      setThemeName(next);
      try { localStorage.setItem('ui.theme', next); } catch {}
    },
    availableThemes: ['Character Dark', 'Light Minimal', 'Auto'],
    accentMode,
    accentHex,
    setAccentMode: (next: 'primary' | 'secondary' | 'custom') => {
      setAccentModeState(next);
      try { localStorage.setItem('ui.accent', next); } catch {}
    },
    setAccentHex: (hex: string) => {
      setAccentHexState(hex);
      try { localStorage.setItem('ui.accentHex', hex); } catch {}
    },
  }), [themeName, accentMode, accentHex]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useUiTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useUiTheme must be used within ThemeProvider');
  return ctx;
}