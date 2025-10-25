import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, Stack, TextField, Button, Divider, IconButton, Tooltip, Alert, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import shopSalesService from '../../services/shopSalesService';

const currency = (v) => `₽${Number(v || 0).toLocaleString('ru-RU')}`;

export default function SaleFormPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const openToast = (severity, message) => setToast({ open: true, severity, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0);
    return { subtotal, grandTotal: subtotal };
  }, [items]);

  const addItem = () => {
    const n = String(name || '').trim();
    const p = Number(price || 0);
    const q = Number(qty || 1);
    if (!n || !(p > 0) || !(q > 0)) {
      openToast('error', 'Укажите наименование, цену и количество');
      return;
    }
    setItems((arr) => arr.concat([{ name: n, price: p, qty: q }]));
    setName(''); setPrice(''); setQty('1');
  };

  const removeItem = (idx) => {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (items.length === 0) {
      openToast('error', 'Добавьте хотя бы один товар');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await shopSalesService.create({ items, note, method });
      if (resp?.ok) {
        openToast('success', 'Продажа создана');
        setItems([]); setNote(''); setMethod('cash');
      } else {
        openToast('error', resp?.error || 'Ошибка создания продажи');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка создания продажи';
      setError(String(msg));
      openToast('error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }} data-tour="shop-sale-root">
      <Typography variant="h5" gutterBottom data-tour="shop-sale-title">Новая продажа</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" data-tour="shop-sale-add-item">
          <TextField label="Наименование" value={name} onChange={(e) => setName(e.target.value)} size="small" sx={{ minWidth: 220 }} inputProps={{ 'data-tour': 'shop-sale-name' }} />
          <TextField label="Цена" value={price} onChange={(e) => setPrice(e.target.value)} size="small" type="number" sx={{ width: 120 }} inputProps={{ 'data-tour': 'shop-sale-price' }} />
          <TextField label="Кол-во" value={qty} onChange={(e) => setQty(e.target.value)} size="small" type="number" sx={{ width: 120 }} inputProps={{ 'data-tour': 'shop-sale-qty' }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={addItem} data-tour="shop-sale-add-btn">Добавить</Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1} data-tour="shop-sale-items-list">
          {items.map((it, idx) => (
            <Stack key={idx} direction="row" alignItems="center" spacing={2}>
              <Typography sx={{ minWidth: 220 }}>{it.name}</Typography>
              <Typography sx={{ width: 120, textAlign: 'right' }}>{currency(it.price)}</Typography>
              <Typography sx={{ width: 120, textAlign: 'right' }}>{it.qty}</Typography>
              <Typography sx={{ width: 160, textAlign: 'right', fontWeight: 700 }}>{currency((it.price || 0) * (it.qty || 0))}</Typography>
              <Tooltip title="Удалить">
                <IconButton onClick={() => removeItem(idx)} size="small"><DeleteIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
          ))}
          {items.length === 0 ? (
            <Typography color="text.secondary">Нет товаров</Typography>
          ) : null}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} size="small" fullWidth inputProps={{ 'data-tour': 'shop-sale-note' }} />
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }} data-tour="shop-sale-total">
          <Typography variant="h6">Итого: {currency(totals.grandTotal)}</Typography>
          <Button variant="contained" onClick={submit} disabled={loading} data-tour="shop-sale-submit">Оформить продажу</Button>
        </Box>
      </Paper>
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast}>
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}