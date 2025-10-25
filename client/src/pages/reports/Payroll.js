import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Paper, Typography, Button } from '@mui/material';
import DataGridBase from '../../components/DataGridBase';
import { reportsService } from '../../services/reportsService';
import { useAuth } from '../../context/AuthContext';
import Chart from '../../components/Chart';
import { payrollService } from '../../services/payrollService';

export default function PayrollReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { hasAnyRole } = useAuth();
  const [summary, setSummary] = useState({ groups: [], total: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await payrollService.listAccruals();
      setItems(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error('Failed to load payroll accruals', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await reportsService.payrollSummary();
      setSummary(data || { groups: [], total: 0 });
    } catch (e) {
      console.error('Failed to load payroll summary', e);
    }
  };

  useEffect(() => { load(); loadSummary(); }, []);

  const columns = useMemo(() => ([
    { field: '_id', headerName: 'ID', width: 140 },
    { field: 'employeeId', headerName: 'Сотрудник', width: 200 },
    { field: 'amount', headerName: 'Сумма', width: 140 },
    { field: 'percent', headerName: 'Процент', width: 120 },
    { field: 'baseAmount', headerName: 'База', width: 140 },
    { field: 'orderId', headerName: 'Заказ/Продажа', width: 200 },
    { field: 'status', headerName: 'Статус', width: 120 },
    { field: 'note', headerName: 'Заметка', width: 200 },
    { field: 'createdAt', headerName: 'Создано', width: 180 },
  ]), []);
  const chartData = useMemo(() => (summary.groups || []).map((g) => ({ name: g.employeeId, amount: g.amount })), [summary]);

  return (
    <Box data-tour="payroll-root">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }} data-tour="payroll-title">Отчёт: Начисления</Typography>
        <Button variant="outlined" onClick={load} data-tour="payroll-refresh">Обновить</Button>
      </Stack>
      <Paper sx={{ height: 520, p: 1, borderRadius: 2, border: '1px solid var(--color-border)' }} data-tour="payroll-grid">
        <DataGridBase rows={items} columns={columns} pageSize={10} loading={loading} />
      </Paper>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid var(--color-border)' }} data-tour="payroll-summary">
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>Сводка по сотрудникам</Typography>
        <Chart data={chartData} dataKey="amount" />
      </Paper>
    </Box>
  );
}