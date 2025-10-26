import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Paper, Alert, Snackbar } from '@mui/material';
import DataGridBase from '../../components/DataGridBase';
import shopSalesService from '../../services/shopSalesService';

const currency = (v) => `₽${Number(v || 0).toLocaleString('ru-RU')}`;
const formatDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleString('ru-RU') : '-';
};

export default function ShopHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const openToast = (severity, message) => setToast({ open: true, severity, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shopSalesService.list({ limit: 200, offset: 0 });
      const arr = Array.isArray(data?.items) ? data.items : [];
      setItems(arr.map((it) => ({
        id: String(it._id || it.id || ''),
        _id: it._id || it.id,
        total: Number(it?.totals?.grandTotal || 0),
        count: Array.isArray(it?.items) ? it.items.length : 0,
        createdAt: it.createdAt || null,
        method: it.method || '',
        note: it.note || '',
      })));
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка загрузки продаж';
      // removed: setError(String(msg));
      openToast('error', String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => ([
    { field: 'id', headerName: 'ID', width: 180 },
    { field: 'count', headerName: 'Позиций', width: 120, type: 'number' },
    { field: 'total', headerName: 'Сумма', width: 160, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (p) => currency(p.value) },
    { field: 'method', headerName: 'Метод', width: 140 },
    { field: 'createdAt', headerName: 'Дата', width: 200, valueFormatter: (p) => formatDateTime(p.value) },
    { field: 'note', headerName: 'Заметка', flex: 1, minWidth: 180 },
  ]), []);

  return (
    <Box sx={{ width: '100%' }} data-tour="shop-history-root">
      <Typography variant="h5" gutterBottom data-tour="shop-history-title">История продаж</Typography>
      <Paper sx={{ width: '100%' }} data-tour="shop-history-grid">
        <DataGridBase
          autoHeight
          rows={items}
          loading={loading}
          columns={columns}
        />
      </Paper>
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast}>
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}