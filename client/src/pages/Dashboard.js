import React, { useMemo, useState } from 'react';
import { Box, Grid, Paper, Typography, Button, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import Chart from '../components/Chart';
import OrdersTable from '../components/OrdersTable';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  ...theme.typography.body2,
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

const formatCurrency = (value) => `₽${Number(value || 0).toLocaleString('ru-RU')}`;

const Dashboard = () => {
  const [filterMode, setFilterMode] = useState('current'); // current | last | all | custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const allOrders = useMemo(() => {
    try {
      const raw = localStorage.getItem('orders');
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, []);

  const filteredOrders = useMemo(() => {
    const orders = allOrders;
    if (filterMode === 'all') return orders;
    const now = new Date();
    let start, end;
    if (filterMode === 'current') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filterMode === 'last') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (filterMode === 'custom') {
      if (!customStart || !customEnd) return orders;
      start = new Date(customStart);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }
    return orders.filter((o) => {
      const d = o.startDate ? new Date(o.startDate) : null;
      return d && d >= start && d <= end;
    });
  }, [allOrders, filterMode, customStart, customEnd]);

  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o.paid || 0), 0);
  const uniqueClients = useMemo(() => {
    const s = new Set(filteredOrders.map((o) => o.client || o.customer || ''));
    s.delete('');
    return s.size;
  }, [filteredOrders]);

  const ordersByDay = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((o) => {
      const d = o.startDate ? new Date(o.startDate) : null;
      const key = d ? d.toISOString().slice(0, 10) : 'unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, orders]) => ({ name, orders }));
  }, [filteredOrders]);

  const revenueByDay = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((o) => {
      const d = o.startDate ? new Date(o.startDate) : null;
      const key = d ? d.toISOString().slice(0, 10) : 'unknown';
      map.set(key, (map.get(key) || 0) + Number(o.paid || 0));
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue }));
  }, [filteredOrders]);

  const tableOrders = useMemo(() => {
    const arr = filteredOrders
      .slice()
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
      .map((o) => ({
        id: o.id,
        customer: o.client || o.customer || '-',
        date: o.startDate ? new Date(o.startDate).toISOString().slice(0, 10) : '-',
        amount: Number(o.amount || 0),
        status: o.status || '-',
      }));
    return arr.slice(0, 10);
  }, [filteredOrders]);

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h4" component="h1" gutterBottom>
            Дашборд
          </Typography>
        </Grid>

        {/* Фильтры периода */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Button variant={filterMode === 'current' ? 'contained' : 'outlined'} onClick={() => setFilterMode('current')}>За текущий месяц</Button>
            <Button variant={filterMode === 'last' ? 'contained' : 'outlined'} onClick={() => setFilterMode('last')}>За прошлый месяц</Button>
            <Button variant={filterMode === 'all' ? 'contained' : 'outlined'} onClick={() => setFilterMode('all')}>Всего</Button>
            <Button variant={filterMode === 'custom' ? 'contained' : 'outlined'} onClick={() => setFilterMode('custom')}>Произвольный период</Button>
            {filterMode === 'custom' && (
              <>
                <TextField type="date" label="Начало" size="small" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                <TextField type="date" label="Конец" size="small" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </>
            )}
          </Box>
        </Grid>
        
        {/* Статистика */}
        <Grid item xs={12} md={4}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Всего заказов
            </Typography>
            <Typography variant="h3">{totalOrders}</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={4}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Выручка
            </Typography>
            <Typography variant="h3">{formatCurrency(totalRevenue)}</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={4}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Клиенты
            </Typography>
            <Typography variant="h3">{uniqueClients}</Typography>
          </Item>
        </Grid>
        
        {/* Графики */}
        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Заказы по дням
            </Typography>
            <Chart data={ordersByDay} dataKey="orders" />
          </Item>
        </Grid>
        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Выручка по дням
            </Typography>
            <Chart data={revenueByDay} dataKey="revenue" />
          </Item>
        </Grid>
        
        {/* Таблица заказов */}
        <Grid item xs={12}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Последние заказы
            </Typography>
            <OrdersTable orders={tableOrders} />
          </Item>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;