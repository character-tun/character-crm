import React from 'react';
import { Box, Typography, Chip, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const RBAC_MENU = {
  '/payments': ['Admin','Finance'],
  '/marketing': ['Admin','Manager'],
  '/services': ['Admin','Manager','Detailing'],
  '/production': ['Admin','Production'],
  '/inventory': ['Admin','Production'],
  '/inventory/products': ['Admin','Production'],
  '/inventory/orders': ['Admin','Production'],
  '/inventory/suppliers': ['Admin','Production'],
  '/shop': ['Admin','Manager'],
  '/reports': ['Admin','Manager'],
  '/announcements': ['Admin','Manager'],
  '/settings': ['Admin','Manager'],
  '/settings/forms/order-types': ['Admin'],
};

const ALL_MENU = [
  '/', '/tasks', '/tasks/list', '/orders', '/clients', '/calendar', '/knowledge',
  ...Object.keys(RBAC_MENU)
];

export default function RbacTest() {
  const { user, roles, hasAnyRole } = useAuth();
  const allowedPaths = ALL_MENU.filter((p) => {
    const need = RBAC_MENU[p];
    if (!need) return true;
    return hasAnyRole(need);
  });

  const canOrderTypesRead = hasAnyRole(['Admin']);
  const canOrderTypesWrite = hasAnyRole(['Admin']);
  const canClientsCRUD = hasAnyRole(['Admin','Manager','Detailing','Production','Finance']);
  const canPayments = hasAnyRole(['Admin','Finance']);
  const canMarketing = hasAnyRole(['Admin','Manager']);
  const canServices = hasAnyRole(['Admin','Manager','Detailing']);
  const canProduction = hasAnyRole(['Admin','Production']);
  const canInventory = hasAnyRole(['Admin','Production']);
  const canSettings = hasAnyRole(['Admin','Manager']);
  const isManagerOrAdmin = hasAnyRole(['Admin','Manager']);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>RBAC тест</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Страница показывает доступные разделы и действия для текущего пользователя.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
        <Typography variant="body1">Пользователь:</Typography>
        <Chip label={user?.email || 'неизвестно'} variant="outlined" />
        <Typography variant="body1">Роли:</Typography>
        {(roles || ['user']).map((r) => (<Chip key={r} label={r} color="primary" variant="outlined" />))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>Доступные маршруты</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
        {allowedPaths.map((p) => (<Chip key={p} label={p} />))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>Разрешённые действия</Typography>
      <List dense>
        <ListItem><ListItemText primary={`Типы заказов (orderTypes.read): ${canOrderTypesRead ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Типы заказов (orderTypes.write): ${canOrderTypesWrite ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Задачи: создавать — доступно всем; просматривать ${isManagerOrAdmin ? 'все задачи' : 'только свои'}; перемещать/обновлять — ${isManagerOrAdmin ? 'все' : 'только свои'}`} /></ListItem>
        <ListItem><ListItemText primary={`Клиенты: создавать/редактировать/удалять — ${canClientsCRUD ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Платежи: доступ к разделу — ${canPayments ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Маркетинг: доступ к разделу — ${canMarketing ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Услуги: доступ к разделу — ${canServices ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Производство и склад: доступ — ${canProduction && canInventory ? 'разрешено' : 'нет доступа'}`} /></ListItem>
        <ListItem><ListItemText primary={`Настройки (включая пользователи и роли): доступ — ${canSettings ? 'разрешено' : 'нет доступа'}`} /></ListItem>
      </List>
    </Box>
  );
}