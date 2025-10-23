import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Divider, Button, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Table, TableHead, TableRow, TableCell, TableBody, Chip, Select, MenuItem, TextField, InputAdornment, Card, CardContent } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useUiTheme } from '../../context/ThemeContext';

export default function UiThemePage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['Admin']);
  const { theme, themeName, setTheme, availableThemes, accentMode, accentHex, setAccentMode, setAccentHex } = useUiTheme();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const accentPreview = useMemo(() => (accentMode === 'custom' ? accentHex : undefined), [accentMode, accentHex]);

  async function saveSettings() {
    setSaving(true); setSaveError(null);
    const payload = { theme: themeName, accentMode, accentHex };
    try {
      await fetch('/api/settings/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      // If route is not available, ignore and keep local
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>Оформление</Typography>
      <Typography variant="body2" sx={{ mb: 3, opacity: 0.75 }}>
        Переключение темы, акцента и предпросмотр компонентов. Настройки сохраняются локально.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'stretch', md: 'center' }}>
        <FormControl sx={{ minWidth: 240 }} disabled={!isAdmin}>
          <FormLabel>Тема</FormLabel>
          <RadioGroup row value={themeName} onChange={(e) => setTheme(e.target.value)}>
            <FormControlLabel value={availableThemes[0]} control={<Radio />} label={availableThemes[0]} />
            <FormControlLabel value={availableThemes[1]} control={<Radio />} label={availableThemes[1]} />
            <FormControlLabel value={availableThemes[2]} control={<Radio />} label={availableThemes[2]} />
          </RadioGroup>
        </FormControl>

        <FormControl sx={{ minWidth: 240 }} disabled={!isAdmin}>
          <FormLabel>Акцент</FormLabel>
          <Select size="small" value={accentMode} onChange={(e) => setAccentMode((e.target.value as 'primary'|'secondary'|'custom'))}>
            <MenuItem value="primary">Primary</MenuItem>
            <MenuItem value="secondary">Secondary</MenuItem>
            <MenuItem value="custom">Custom HEX</MenuItem>
          </Select>
        </FormControl>

        {accentMode === 'custom' && (
          <TextField
            size="small"
            label="HEX"
            value={accentHex}
            disabled={!isAdmin}
            onChange={(e) => setAccentHex(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">#</InputAdornment> }}
            sx={{ minWidth: 180 }}
          />
        )}

        <Button variant="contained" onClick={saveSettings} disabled={!isAdmin || saving}>Сохранить</Button>
        {saveError && <Typography variant="body2" color="error">{saveError}</Typography>}
      </Stack>

      {!isAdmin && (
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Редактирование доступно только пользователям с ролью Admin.
        </Typography>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Превью компонентов */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, flex: 1, borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Card</Typography>
          <Card sx={{ mt: 2, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', backgroundColor: 'var(--color-surface)' }}>
            <CardContent>
              <Typography variant="body2">Это карточка с токенами темы.</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" color="primary">Primary</Button>
                <Button variant="contained" color="secondary">Secondary</Button>
                <Button variant="outlined">Outlined</Button>
              </Stack>
            </CardContent>
          </Card>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-border)' }} />
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--color-secondary)', border: '1px solid var(--color-border)' }} />
            {accentPreview && <Box sx={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: accentPreview, border: '1px solid var(--color-border)' }} />}
          </Box>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surfaceAlt)', color: 'var(--color-text)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Table & StatusChip</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Статус</TableCell>
                <TableCell>Название</TableCell>
                <TableCell align="right">Сумма</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell><Chip label="Draft" className="status-chip status-chip--draft" /></TableCell>
                <TableCell>Заявка #1</TableCell>
                <TableCell align="right">12 500 ₽</TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell><Chip label="Progress" className="status-chip status-chip--in-progress" /></TableCell>
                <TableCell>Заявка #2</TableCell>
                <TableCell align="right">8 200 ₽</TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell><Chip label="Success" className="status-chip status-chip--success" /></TableCell>
                <TableCell>Заявка #3</TableCell>
                <TableCell align="right">5 200 ₽</TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell><Chip label="Fail" className="status-chip status-chip--fail" /></TableCell>
                <TableCell>Заявка #4</TableCell>
                <TableCell align="right">2 400 ₽</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Box>
  );
}