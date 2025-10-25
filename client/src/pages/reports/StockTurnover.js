import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Paper, Typography, Button } from '@mui/material';
import Chart from '../../components/Chart';
import { reportsService } from '../../services/reportsService';

export default function StockTurnoverReport() {
  const [summary, setSummary] = useState({ groups: [], totals: { receiptQty: 0, issueQty: 0, inventoryQty: 0, netQty: 0 } });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reportsService.stockTurnover();
      setSummary(data || { groups: [], totals: {} });
    } catch (e) {
      console.error('Failed to load stock turnover', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const issueChartData = useMemo(() => (summary.groups || []).map((g) => ({ name: g.itemId, issueQty: g.totals.issueQty })), [summary]);
  const receiptChartData = useMemo(() => (summary.groups || []).map((g) => ({ name: g.itemId, receiptQty: g.totals.receiptQty })), [summary]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Отчёт: Оборот склада</Typography>
        <Button variant="outlined" onClick={load} disabled={loading}>Обновить</Button>
      </Stack>

      <Stack spacing={2}>
        <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>Расход по товарам</Typography>
          <Chart data={issueChartData} dataKey="issueQty" />
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>Приход по товарам</Typography>
          <Chart data={receiptChartData} dataKey="receiptQty" />
        </Paper>
      </Stack>
    </Box>
  );
}