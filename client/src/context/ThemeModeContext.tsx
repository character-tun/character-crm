import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ThemeMode } from '../theme/tokens';

export type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function getPreferredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem('ui.theme.mode');
    if (saved === 'light' || saved === 'dark') return saved as ThemeMode;
  } catch {}
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getPreferredMode());

  useEffect(() => {
    try { localStorage.setItem('ui.theme.mode', mode); } catch {}
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(() => ({
    mode,
    setMode: (next: ThemeMode) => setModeState(next),
    toggle: () => setModeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}