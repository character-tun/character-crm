import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, FormControlLabel, Switch } from '@mui/material';
import SettingsBackBar from '../../components/SettingsBackBar';

const STORAGE_KEY = 'settings_clients_notifications';

const ClientsNotifications = () => {
  const [state, setState] = useState({ sms: true, email: true, telegram: false });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const handleChange = (key) => (e) => {
    const updated = { ...state, [key]: e.target.checked };
    setState(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  return (
    <Box>
      <SettingsBackBar title="Уведомления клиентов" onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack spacing={2}>
          <FormControlLabel control={<Switch checked={state.sms} onChange={handleChange('sms')} />} label="SMS уведомления" />
          <FormControlLabel control={<Switch checked={state.email} onChange={handleChange('email')} />} label="Email уведомления" />
          <FormControlLabel control={<Switch checked={state.telegram} onChange={handleChange('telegram')} />} label="Telegram уведомления" />
        </Stack>
      </Paper>
    </Box>
  );
};

export default ClientsNotifications;