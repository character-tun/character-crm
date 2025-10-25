import React from 'react';
import { Box, Typography, Grid, Paper, Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SmsIcon from '@mui/icons-material/Sms';
import SettingsIcon from '@mui/icons-material/Settings';
import PaymentIcon from '@mui/icons-material/Payment';
import CategoryIcon from '@mui/icons-material/Category';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';

const ItemCard = ({ title, subtitle, icon, to }) => {
  const navigate = useNavigate();
  return (
    <Paper 
      onClick={() => navigate(to)}
      sx={{ 
        p: 2, 
        borderRadius: 'var(--radius)', 
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 'var(--shadow)' }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 1.5,
          backgroundColor: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)'
        }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>{subtitle}</Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

const Settings = () => {
  const sections = [
    {
      group: 'Компания',
      items: [
        { title: 'Компания', subtitle: 'Название, контакты, реквизиты, страна, валюта', icon: <BusinessIcon />, to: '/settings/company' },
        { title: 'Сотрудники', subtitle: 'Список, роли и права', icon: <PeopleIcon />, to: '/settings/employees' },
        { title: 'Пользователи', subtitle: 'Учётные записи для входа', icon: <PeopleIcon />, to: '/settings/users' },
        { title: 'Роли', subtitle: 'Права доступа и код роли', icon: <AssignmentIndIcon />, to: '/settings/roles' },
        { title: 'Документы', subtitle: 'Шаблоны актов и квитанций', icon: <DescriptionIcon />, to: '/settings/documents' },
      ]
    },
    {
      group: 'Заказы',
      items: [
        { title: 'Общие настройки', subtitle: 'Базовые параметры заказа', icon: <SettingsIcon />, to: '/settings/orders/general' },
        { title: 'Статусы заказов', subtitle: 'Настройка этапов и статусов', icon: <ListAltIcon />, to: '/settings/order-statuses' },
        { title: 'SMS шаблоны', subtitle: 'Сообщения клиентам по этапам', icon: <SmsIcon />, to: '/settings/orders/sms' },
        { title: 'Типы заказов', subtitle: 'Категории и типы работ', icon: <ShoppingCartIcon />, to: '/settings/forms/order-types' },
        { title: 'Поля заказа', subtitle: 'Конструктор полей', icon: <ListAltIcon />, to: '/settings/forms/order-fields' },
      ]
    },
    {
      group: 'Клиенты',
      items: [
        { title: 'Уведомления клиентов', subtitle: 'SMS, email, Telegram', icon: <AssignmentIndIcon />, to: '/settings/clients/notifications' },
        { title: 'Типы клиентов', subtitle: 'Сегменты и категории', icon: <CategoryIcon />, to: '/settings/forms/client-types' },
        { title: 'Поля клиента', subtitle: 'Конструктор полей', icon: <ListAltIcon />, to: '/settings/forms/client-fields' },
      ]
    },
    {
      group: 'Платежи',
      items: [
        { title: 'Статьи (категории)', subtitle: 'Доходы и расходы', icon: <CategoryIcon />, to: '/settings/payments/articles' },
        { title: 'Способы оплаты', subtitle: 'Наличные, карта, перевод', icon: <PaymentIcon />, to: '/settings/payments/methods' },
        { title: 'Кассы', subtitle: 'Создание касс, быстрые платежи', icon: <PaymentIcon />, to: '/settings/cash-registers' },
        { title: 'Правила начислений', subtitle: 'Проценты, базы, условия', icon: <AssignmentIndIcon />, to: '/settings/payroll/rules' },
      ]
    },
    {
      group: 'Справочники',
      items: [
        { title: 'Справочники', subtitle: 'Единицы, марки авто и т.д.', icon: <CategoryIcon />, to: '/settings/forms/directories' },
      ]
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 800 }}>Настройки системы</Typography>
      <Typography variant="body2" sx={{ mb: 3, opacity: 0.75 }}>
        Выберите раздел для настройки модулей CRM. Страница поддерживает вертикальный скролл для длинных списков.
      </Typography>

      <Box sx={{ p: 2, borderRadius: 2 }} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <Stack spacing={4}>
          {sections.map((section) => (
            <Box key={section.group}>
              <Chip label={section.group} sx={{ mb: 2, fontWeight: 700 }} />
              <Grid container spacing={2}>
                {section.items.filter(item => item && item.title && item.to).map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.title}>
                    <ItemCard {...item} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default Settings;