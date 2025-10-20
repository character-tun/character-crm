import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';

const formatDateTime = (dt) => {
  try {
    const d = typeof dt === 'string' || typeof dt === 'number' ? new Date(dt) : dt;
    return d ? d.toLocaleString('ru-RU') : '';
  } catch (e) {
    return String(dt || '');
  }
};

const ActionChips = ({ actions = [] }) => {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
      {actions.map((a, idx) => (
        <Chip key={idx} size="small" label={(a && (a.label || a.type || a.action || 'action'))} />
      ))}
    </Stack>
  );
};

export default function OrderTimeline({ logs = [], loading = false, error = '' }) {
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">Загрузка истории…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">{error}</Typography>
      </Box>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">Смен статусов пока не было</Typography>
      </Box>
    );
  }

  return (
    <List dense>
      {logs.map((log, idx) => {
        const when = formatDateTime(log?.createdAt);
        const from = log?.from ?? '-';
        const to = log?.to ?? '-';
        const user = log?.userName || log?.userId || '-';
        const note = log?.note || '';
        const actions = log?.actionsEnqueued || [];
        return (
          <ListItem key={idx} alignItems="flex-start" sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{when}</Typography>
                  <Typography variant="body2">{from} → {to}</Typography>
                  <Typography variant="body2" color="text.secondary">Пользователь: {user}</Typography>
                </Box>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  {note ? (
                    <Typography variant="caption" color="text.secondary">Заметка: {note}</Typography>
                  ) : null}
                  <ActionChips actions={actions} />
                </Box>
              }
            />
          </ListItem>
        );
      })}
    </List>
  );
}