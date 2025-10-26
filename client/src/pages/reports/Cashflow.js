import React from 'react';
import { Box, Container, Typography, Paper, Stack, Divider, Chip, Button } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { reportsService } from '../../services/reportsService';
import { cashService } from '../../services/cashService';
import FiltersBar from '../../components/FiltersBar.jsx';
import { formatCurrencyRu } from '../../services/format';
import EmptyState from '../../components/EmptyState.jsx';
import { useNotify } from '../../components/NotifyProvider';

export default function CashflowReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const [filters, setFilters] = React.useState({ dateFrom: '', dateTo: '', cashRegisterId: '', article: '', locationId: '', q: '' });
  const [cash, setCash] = React.useState([]);
  const locations = React.useMemo(() => {
    const s = new Set();
    cash.forEach((c) => { if (c.locationId) s.add(String(c.locationId)); });
    return Array.from(s);
  }, [cash]);

  const [state, setState] = React.useState({ groups: [], balance: 0, loading: true, error: '' });

  const { dateFrom, dateTo, locationId } = filters;

  // Initialize filters from URL on mount
  React.useEffect(() => {
    const p = Object.fromEntries(searchParams.entries());
    setFilters((f) => ({
      ...f,
      dateFrom: p.dateFrom || f.dateFrom,
      dateTo: p.dateTo || f.dateTo,
      cashRegisterId: p.cashRegisterId || f.cashRegisterId,
      article: p.articlePath || f.article,
      locationId: p.locationId || f.locationId,
      q: p.q || f.q,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to URL
  React.useEffect(() => {
    const q = {};
    if (filters.dateFrom) q.dateFrom = filters.dateFrom;
    if (filters.dateTo) q.dateTo = filters.dateTo;
    if (filters.cashRegisterId) q.cashRegisterId = filters.cashRegisterId;
    if (filters.article) q.articlePath = filters.article;
    if (filters.locationId) q.locationId = filters.locationId;
    if (filters.q) q.q = filters.q;
    setSearchParams(q, { replace: true });
  }, [filters, setSearchParams]);

  // Load cash registers (for FiltersBar options)
  React.useEffect(() => {
    cashService.list({ limit: 200, offset: 0 }).then((res) => {
      const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setCash(arr);
    }).catch(() => {});
  }, []);

  // Fetch cashflow report when relevant filters change
  React.useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    reportsService.cashflow({ dateFrom, dateTo, locationId }).then((data) => {
      if (data && data.ok) {
        setState({ groups: data.groups || [], balance: Number(data.balance || 0), loading: false, error: '' });
      } else {
        setState({ groups: [], balance: 0, loading: false, error: 'NO_DATA' });
      }
    }).catch((e) => {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка загрузки отчёта ДДС';
      setState({ groups: [], balance: 0, loading: false, error: 'ERROR' });
      notify(String(msg), { severity: 'error' });
    });
  }, [dateFrom, dateTo, locationId, notify]);

  const visibleGroups = React.useMemo(() => {
    const id = String(filters.cashRegisterId || '');
    const groups = Array.isArray(state.groups) ? state.groups : [];
    return id ? groups.filter((g) => String(g.cashRegisterId || '') === id) : groups;
  }, [state.groups, filters.cashRegisterId]);

  const income = visibleGroups.reduce((acc, g) => acc + Number(g.totals?.income || 0), 0);
  const expense = visibleGroups.reduce((acc, g) => acc + Number(g.totals?.expense || 0), 0);
  const refund = visibleGroups.reduce((acc, g) => acc + Number(g.totals?.refund || 0), 0);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Отчёт: ДДС (Cashflow)
      </Typography>

      <Paper sx={{ p: 2 }}>
        <FiltersBar
          value={filters}
          onChange={(next) => setFilters(next)}
          cashRegisters={cash}
          locations={locations}
          articles={[]}
        />
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Chip label={`Период: ${filters.dateFrom || '-'} → ${filters.dateTo || '-'}`} />
          <Chip color="success" variant="outlined" label={`Приход: ${formatCurrencyRu(income)}`} />
          <Chip color="error" variant="outlined" label={`Расход: ${formatCurrencyRu(expense + refund)}`} />
          <Chip variant="outlined" label={`Сальдо: ${formatCurrencyRu(state.balance)}`} />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>Группы по кассам</Typography>
        <Stack spacing={1}>
          {(visibleGroups || []).map((g) => (
            <Box key={g.cashRegisterId} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>#{g.cashRegisterId}</Typography>
              <Typography variant="body2">Приход: {formatCurrencyRu(Number(g.totals?.income || 0))}</Typography>
              <Typography variant="body2">Расход: {formatCurrencyRu(Number(g.totals?.expense || 0) + Number(g.totals?.refund || 0))}</Typography>
              <Typography variant="body2">Сальдо: {formatCurrencyRu(Number(g.totals?.balance || 0))}</Typography>
            </Box>
          ))}
          {(!state.loading && (visibleGroups || []).length === 0) && (
            <Box sx={{ mt: 1 }}>
              <EmptyState
                title="Нет данных"
                description="Попробуйте изменить фильтры или диапазон дат."
                actionLabel="Открыть платежи"
                onAction={() => navigate('/payments')}
              />
            </Box>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}