import React from 'react';
import { ToggleButtonGroup, ToggleButton, Box } from '@mui/material';
import { useUiTheme } from '../context/ThemeContext';

export default function ThemeSwitcher({ size = 'small', disabled = false }: { size?: 'small' | 'medium'; disabled?: boolean }) {
  const { theme, setTheme, availableThemes } = useUiTheme();

  const renderIcon = (name: string) => {
    const isLight = /light/i.test(name);
    const emoji = isLight ? '☀️' : '🌙';
    const fontSize = size === 'small' ? 16 : 18;
    return <span aria-hidden="true" style={{ fontSize, lineHeight: 1 }}>{emoji}</span>;
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <ToggleButtonGroup
        size={size}
        exclusive
        disabled={disabled}
        value={theme.name}
        onChange={(_, next) => next && setTheme(next)}
        aria-label="Сменить тему"
      >
        {availableThemes.map((name) => (
          <ToggleButton key={name} value={name} aria-label={name} sx={{ textTransform: 'none' }} disabled={disabled}>
            {renderIcon(name)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}