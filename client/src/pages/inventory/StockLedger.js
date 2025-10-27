import React from 'react';
import { Box, Paper, Stack, TextField, Button, Typography, Alert } from '@mui/material';
import DataGridBase from '../../components/DataGridBase';
import EmptyState from '../../components/EmptyState';
import { stocksService } from '../../services/stocksService';

export default function InventoryStockLog() {
  const [filters, setFilters] = React.useState({ itemId: '', locationId: '', refType: '' });
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const setField = (field, value) => setFilters((f) => ({ ...f, [field]: value }));

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.itemId) params.itemId = filters.itemId.trim();
      if (filters.locationId) params.locationId = filters.locationId.trim();
      if (filters.refType) params.refType = filters.refType.trim();
      params.limit = 50; params.offset = 0;
      const data = await stocksService.ledger(params);
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setItems(list);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => { load(); }, []);

  const columns = React.useMemo(() => [
    { field: 'ts', headerName: 'Дата', width: 180, valueGetter: (p) => { const v = p.row.ts; return v ? new Date(v).toLocaleString('ru-RU') : ''; } },
    { field: 'itemId', headerName: 'Item ID', width: 220, valueGetter: (p) => String(p.row.itemId || '') },
    { field: 'locationId', headerName: 'Локация', width: 180, valueGetter: (p) => String(p.row.locationId || '') },
    { field: 'qty', headerName: 'Кол-во', width: 120, type: 'number', valueGetter: (p) => Number(p.row.qty || 0) },
    { field: 'refType', headerName: 'Тип ссылки', width: 160, valueGetter: (p) => String(p.row.refType || '') },
    { field: 'refId', headerName: 'ID ссылки', width: 200, valueGetter: (p) => String(p.row.refId || '') },
    { field: 'note', headerName: 'Примечание', flex: 1, valueGetter: (p) => String(p.row.note || '') },
    { field: 'cost', headerName: 'Себестоимость', width: 140, type: 'number', valueGetter: (p) => (typeof p.row.cost === 'number' ? p.row.cost : '') },
  ], []);

  const getRowId = (row) => String(row._id || `${row.ts}|${row.itemId}|${row.locationId}|${row.qty}`);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>Лог склада</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        История движений товара на складе. Фильтры по itemId, локации и типу ссылки.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Item ID"
            value={filters.itemId}
            onChange={(e) => setField('itemId', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            fullWidth
          />
          <TextField
            label="Локация ID"
            value={filters.locationId}
            onChange={(e) => setField('locationId', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            fullWidth
          />
          <TextField
            label="Тип ссылки"
            value={filters.refType}
            onChange={(e) => setField('refType', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            fullWidth
          />
          <Button variant="contained" onClick={load} disabled={loading}>Обновить</Button>
        </Stack>
      </Paper>

      {error ? (<Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>) : null}

      {Array.isArray(items) && items.length > 0 ? (
        <Paper sx={{ height: 520 }}>
          <DataGridBase
            rows={items}
            columns={columns}
            loading={loading}
            getRowId={getRowId}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          />
        </Paper>
      ) : (
        <EmptyState title="Нет данных" description="Попробуйте изменить фильтры и обновить." />
      )}
    </Box>
  );
}