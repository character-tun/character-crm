import React from 'react';
import { Card, CardContent, Stack, Typography, Divider, Button, Box, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { reportsService } from '../../services/reportsService';
import { paymentsService } from '../../services/paymentsService';
import { formatCurrencyRu } from '../../services/format';

function getLast7DaysRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const dateFrom = format(start, 'yyyy-MM-dd');
  const dateTo = format(end, 'yyyy-MM-dd');
  return { start, end, dateFrom, dateTo };
}

function computeDailyNet(items, start, end) {
  const days = [];
  const byDate = new Map();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = format(d, 'yyyy-MM-dd');
    days.push(key);
    byDate.set(key, 0);
  }
  (items || []).forEach((it) => {
    const d = it.createdAt ? new Date(it.createdAt) : null;
    if (!d) return;
    const key = format(d, 'yyyy-MM-dd');
    if (!byDate.has(key)) return; // outside of 7-day range
    const amt = Number(it.amount || 0);
    const t = String(it.type || '');
    const delta = t === 'income' ? amt : (t === 'expense' ? -amt : (t === 'refund' ? -amt : 0));
    byDate.set(key, (byDate.get(key) || 0) + delta);
  });
  return days.map((key) => ({ key, value: byDate.get(key) || 0 }));
}

function toSparkPath(points, width = 180, height = 56, padding = 6) {
  if (!points || points.length === 0) return '';
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const rangeY = maxY - minY || 1;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const mapY = (v) => {
    const t = (v - minY) / rangeY; // 0..1
    return height - padding - t * (height - padding * 2);
  };
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padding + i * stepX} ${mapY(p.value)}`).join(' ');
  return path;
}

export default function FinanceWidget() {
  const nav = useNavigate();
  const [{ income, expense, balance }, setTotals] = React.useState({ income: 0, expense: 0, balance: 0 });
  const [trend, setTrend] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const range = React.useMemo(() => getLast7DaysRange(), []);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    const { dateFrom, dateTo, start, end } = range;

    const p1 = reportsService.cashflow({ dateFrom, dateTo }).catch(() => null);
    const p2 = paymentsService.list({ dateFrom, dateTo, limit: 500 }).catch(() => null);

    Promise.allSettled([p1, p2]).then((results) => {
      if (!mounted) return;
      const cfRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const listRes = results[1].status === 'fulfilled' ? results[1].value : null;

      // Totals from cashflow endpoint or fallback to list totals
      if (cfRes && cfRes.ok) {
        const groups = Array.isArray(cfRes.groups) ? cfRes.groups : [];
        const totals = groups.reduce((acc, g) => ({
          income: acc.income + Number(g.totals?.income || 0),
          expense: acc.expense + Number(g.totals?.expense || 0),
          refund: acc.refund + Number(g.totals?.refund || 0),
        }), { income: 0, expense: 0, refund: 0 });
        setTotals({ income: totals.income, expense: totals.expense + totals.refund, balance: Number(cfRes.balance || 0) });
      } else if (listRes && listRes.ok && listRes.totals) {
        const t = listRes.totals || { income: 0, expense: 0, refund: 0 };
        setTotals({ income: Number(t.income || 0), expense: Number(t.expense || 0) + Number(t.refund || 0), balance: Number(t.balance || 0) });
      } else {
        setTotals({ income: 0, expense: 0, balance: 0 });
      }

      // Trend from list items
      const items = (listRes && listRes.ok && Array.isArray(listRes.items)) ? listRes.items : [];
      const daily = computeDailyNet(items, start, end);
      setTrend(daily);
    }).finally(() => setLoading(false));

    return () => { mounted = false; };
  }, [range]);

  const handleToReports = React.useCallback(() => {
    const q = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo });
    nav(`/reports/cashflow?${q.toString()}`);
  }, [nav, range]);

  const sparkPath = React.useMemo(() => toSparkPath(trend, 180, 56, 6), [trend]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack>
            <Typography variant="overline" color="text.secondary">Финансы — неделя</Typography>
            <Typography variant="caption" color="text.secondary">
              {range.dateFrom} → {range.dateTo}
            </Typography>
          </Stack>
          <Button size="small" variant="contained" onClick={handleToReports}>К отчётам</Button>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {loading ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="rounded" width={120} height={24} />
            <Skeleton variant="rounded" width={120} height={24} />
            <Skeleton variant="rounded" width={120} height={24} />
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Stack spacing={0.25} sx={{ minWidth: 160 }}>
              <Typography variant="caption" color="success.main">Приход</Typography>
              <Typography variant="h6">{formatCurrencyRu(income)}</Typography>
            </Stack>
            <Stack spacing={0.25} sx={{ minWidth: 160 }}>
              <Typography variant="caption" color="error.main">Расход</Typography>
              <Typography variant="h6">{formatCurrencyRu(expense)}</Typography>
            </Stack>
            <Stack spacing={0.25} sx={{ minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">Сальдо</Typography>
              <Typography variant="h6">{formatCurrencyRu(balance)}</Typography>
            </Stack>
            <Box sx={{ flex: 1, minWidth: 180 }}>
              {trend && trend.length > 0 ? (
                <svg width={180} height={56} role="img" aria-label="weekly trend">
                  <path d={sparkPath} stroke="currentColor" strokeWidth={2} fill="none" />
                </svg>
              ) : (
                <Skeleton variant="rounded" width={180} height={56} />
              )}
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}