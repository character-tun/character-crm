import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, FormControlLabel, Switch, TextField } from '@mui/material';

const STORAGE_KEY = 'settings_orders_general';

const OrdersGeneral = () => {
  const [state, setState] = useState({ autoCreateInvoice: false, allowPrepayment: true, defaultStatus: 'Новый' });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const handleToggle = (key) => (e) => {
    const updated = { ...state, [key]: e.target.checked };
    setState(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleChange = (e) => {
    const updated = { ...state, [e.target.name]: e.target.value };
    setState(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 800 }}>Заказы: общие настройки</Typography>
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #2a2f37' }}>
        <Stack spacing={2}>
          <FormControlLabel control={<Switch checked={state.autoCreateInvoice} onChange={handleToggle('autoCreateInvoice')} />} label="Автосоздание счёта при создании заказа" />
          <FormControlLabel control={<Switch checked={state.allowPrepayment} onChange={handleToggle('allowPrepayment')} />} label="Разрешить предоплату" />
          <TextField label="Статус по умолчанию" name="defaultStatus" value={state.defaultStatus} onChange={handleChange} />
        </Stack>
      </Paper>
    </Box>
  );
};

export default OrdersGeneral;