import React from 'react';
import { Box, Typography, Grid, Paper, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';

// Стилизованные компоненты
const StatCard = styled(Paper)(({ theme, positive }) => ({
  padding: '20px',
  borderRadius: '12px',
  backgroundColor: '#242424',
  color: '#fff',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  '& .trend-icon': {
    color: positive ? '#4caf50' : '#f44336',
    marginLeft: '8px',
    fontSize: '20px',
  },
  '& .value': {
    fontSize: '28px',
    fontWeight: 'bold',
    marginTop: '8px',
    marginBottom: '8px',
  },
  '& .label': {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  '& .period': {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  }
}));

const ChartContainer = styled(Paper)(({ theme }) => ({
  padding: '20px',
  borderRadius: '12px',
  backgroundColor: '#242424',
  color: '#fff',
  height: '100%',
  '& .title': {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
  }
}));

// Моковые данные
const dailyData = [
  { day: 'Пн', orders: 12, revenue: 45000 },
  { day: 'Вт', orders: 19, revenue: 67000 },
  { day: 'Ср', orders: 15, revenue: 53000 },
  { day: 'Чт', orders: 21, revenue: 72000 },
  { day: 'Пт', orders: 25, revenue: 89000 },
  { day: 'Сб', orders: 18, revenue: 64000 },
  { day: 'Вс', orders: 10, revenue: 38000 },
];

const monthlyData = [
  { month: 'Янв', orders: 120, revenue: 450000 },
  { month: 'Фев', orders: 150, revenue: 520000 },
  { month: 'Мар', orders: 180, revenue: 630000 },
  { month: 'Апр', orders: 210, revenue: 720000 },
  { month: 'Май', orders: 190, revenue: 680000 },
  { month: 'Июн', orders: 220, revenue: 790000 },
  { month: 'Июл', orders: 250, revenue: 890000 },
];

const serviceData = [
  { name: 'Полировка', value: 35 },
  { name: 'Керамика', value: 25 },
  { name: 'Химчистка', value: 20 },
  { name: 'Защита', value: 15 },
  { name: 'Другое', value: 5 },
];

function Trends() {
  const theme = useTheme();

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, color: '#fff' }}>
        Тренды
      </Typography>

      <Grid container spacing={3}>
        {/* Статистические карточки */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard positive={true}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography className="label">Заказы по дням</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#4caf50' }}>+12%</Typography>
                <TrendingUpIcon className="trend-icon" />
              </Box>
            </Box>
            <Typography className="value">7 дней</Typography>
            <Typography className="period">За последнюю неделю</Typography>
          </StatCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard positive={true}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography className="label">Средний чек заказов</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#4caf50' }}>+8%</Typography>
                <TrendingUpIcon className="trend-icon" />
              </Box>
            </Box>
            <Typography className="value">₽ 35,400</Typography>
            <Typography className="period">За последнюю неделю</Typography>
          </StatCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard positive={false}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography className="label">Новые клиенты</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#f44336' }}>-3%</Typography>
                <TrendingDownIcon className="trend-icon" />
              </Box>
            </Box>
            <Typography className="value">12</Typography>
            <Typography className="period">За последнюю неделю</Typography>
          </StatCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard positive={true}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography className="label">Загрузка боксов</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#4caf50' }}>+5%</Typography>
                <TrendingUpIcon className="trend-icon" />
              </Box>
            </Box>
            <Typography className="value">78%</Typography>
            <Typography className="period">За последнюю неделю</Typography>
          </StatCard>
        </Grid>

        {/* Графики */}
        <Grid item xs={12} md={8}>
          <ChartContainer>
            <Typography className="title">Динамика заказов и выручки</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.5)" />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#333', border: 'none' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar yAxisId="left" dataKey="orders" fill="#4285f4" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" fill="#34a853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>

        <Grid item xs={12} md={4}>
          <ChartContainer>
            <Typography className="title">Популярность услуг</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#333', border: 'none' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>

        <Grid item xs={12}>
          <ChartContainer>
            <Typography className="title">Динамика по месяцам</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#333', border: 'none' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="orders" stroke="#4285f4" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="revenue" stroke="#34a853" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Trends;