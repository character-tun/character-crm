import React from 'react';
import { Box, Container, Typography, Paper, Stack, Divider, Chip } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { reportsService } from '../../services/reportsService';
import { formatCurrencyRu } from '../../services/format';

export default function CashflowReport() {
  const [params] = useSearchParams();
  const [state, setState] = React.useState({ groups: [], balance: 0, loading: true, error: '' });

  React.useEffect(() => {
    const dateFrom = params.get('dateFrom') || '';
    const dateTo = params.get('dateTo') || '';
    setState((s) => ({ ...s, loading: true, error: '' }));
    reportsService.cashflow({ dateFrom, dateTo }).then((data) => {
      if (data && data.ok) {
        setState({ groups: data.groups || [], balance: Number(data.balance || 0), loading: false, error: '' });
      } else {
        setState({ groups: [], balance: 0, loading: false, error: 'NO_DATA' });
      }
    }).catch((e) => {
      setState({ groups: [], balance: 0, loading: false, error: 'ERROR' });
    });
  }, [params]);

  const income = state.groups.reduce((acc, g) => acc + Number(g.totals?.income || 0), 0);
  const expense = state.groups.reduce((acc, g) => acc + Number(g.totals?.expense || 0), 0);
  const refund = state.groups.reduce((acc, g) => acc + Number(g.totals?.refund || 0), 0);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Отчёт: ДДС (Cashflow)
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Chip label={`Период: ${params.get('dateFrom') || '-'} → ${params.get('dateTo') || '-'}`} />
          <Chip color="success" variant="outlined" label={`Приход: ${formatCurrencyRu(income)}`} />
          <Chip color="error" variant="outlined" label={`Расход: ${formatCurrencyRu(expense + refund)}`} />
          <Chip variant="outlined" label={`Сальдо: ${formatCurrencyRu(state.balance)}`} />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>Группы по кассам</Typography>
        <Stack spacing={1}>
          {(state.groups || []).map((g) => (
            <Box key={g.cashRegisterId} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>#{g.cashRegisterId}</Typography>
              <Typography variant="body2">Приход: {formatCurrencyRu(Number(g.totals?.income || 0))}</Typography>
              <Typography variant="body2">Расход: {formatCurrencyRu(Number(g.totals?.expense || 0) + Number(g.totals?.refund || 0))}</Typography>
              <Typography variant="body2">Сальдо: {formatCurrencyRu(Number(g.totals?.balance || 0))}</Typography>
            </Box>
          ))}
          {(state.groups || []).length === 0 && (
            <Typography variant="body2" color="text.secondary">Данных нет или отсутствуют права доступа.</Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}