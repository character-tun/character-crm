import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Stack, Typography, List, ListItem, ListItemIcon, ListItemText, Checkbox, Button, LinearProgress, Chip } from '@mui/material';
import { useNotify } from '../components/NotifyProvider';

const LS_KEY = 'onboarding.checklist.v1';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      { id: 'add-client', label: 'Добавьте клиента', done: false, to: '/clients' },
      { id: 'create-order', label: 'Создайте заказ', done: false, to: '/orders' },
      { id: 'download-act', label: 'Скачайте акт', done: false, to: '/settings/documents' },
    ];
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  useEffect(() => {
    const welcomed = localStorage.getItem('onboarding.welcomeSent');
    if (!welcomed) {
      notify('Добро пожаловать! Начните с быстрого чек‑листа.', { severity: 'info' });
      localStorage.setItem('onboarding.welcomeSent', '1');
    }
  }, [notify]);

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    return Math.round((done / total) * 100);
  }, [items]);

  const toggle = (id) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const go = (to) => navigate(to);

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>Быстрый старт</Typography>
        <LinearProgress variant="determinate" value={progress} />
        <List>
          {items.map((i) => (
            <ListItem key={i.id} secondaryAction={<Button variant="outlined" onClick={() => go(i.to)}>Открыть</Button>}>
              <ListItemIcon>
                <Checkbox edge="start" checked={i.done} onChange={() => toggle(i.id)} />
              </ListItemIcon>
              <ListItemText primary={i.label} secondary={i.done ? <Chip size="small" color="success" label="Выполнено" /> : null} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={() => navigate('/')}>Перейти в систему</Button>
          <Button variant="text" onClick={() => navigate('/landing')}>Вернуться на лендинг</Button>
        </Box>
      </Stack>
    </Container>
  );
}