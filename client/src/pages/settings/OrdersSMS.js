import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button } from '@mui/material';
import SettingsBackBar from '../../components/SettingsBackBar';

const STORAGE_KEY = 'settings_orders_sms_templates';

const defaultTemplates = {
  created: 'Ваш заказ создан. ID: {{orderId}}',
  inProgress: 'Ваш заказ в работе. Статус: {{status}}',
  done: 'Ваш заказ готов. Сумма к оплате: {{amount}} ₽',
};

const OrdersSMS = () => {
  const [templates, setTemplates] = useState(defaultTemplates);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTemplates((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...templates, [name]: value };
    setTemplates(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleReset = () => {
    setTemplates(defaultTemplates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTemplates));
  };

  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  };

  return (
    <Box>
      <SettingsBackBar title="SMS шаблоны" onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack spacing={2}>
          <TextField label="Создан" name="created" value={templates.created} onChange={handleChange} fullWidth multiline minRows={2} />
          <TextField label="В работе" name="inProgress" value={templates.inProgress} onChange={handleChange} fullWidth multiline minRows={2} />
          <TextField label="Готов" name="done" value={templates.done} onChange={handleChange} fullWidth multiline minRows={2} />
          <Button variant="outlined" color="secondary" onClick={handleReset}>Сбросить к стандартным</Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default OrdersSMS;