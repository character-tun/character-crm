import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, Stack, Button, Grid, FormControl, InputLabel, Select, MenuItem, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Checkbox, Tooltip, IconButton, Alert, Snackbar, Skeleton, Divider } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentIcon from '@mui/icons-material/Payment';
import DataGridBase from '../../components/DataGridBase';
import PaymentDialog from '../../components/PaymentDialog.jsx';
import { cashService } from '../../services/cashService';
import { paymentsService } from '../../services/paymentsService';
import { useAuth } from '../../context/AuthContext';

const currency = (v) => `₽${Number(v || 0).toLocaleString('ru-RU')}`;

// Minimal articles support copied from Payments for PaymentDialog
function readCategoriesTree() {
  return {
    income: [
      { name: 'Продажи', children: ['Оплата заказа','Оплата продажи','Предоплата заказа','Предоплата'] },
      { name: 'Прочее', children: ['Внесение в кассу','Перемещение денег'] },
    ],
    expense: [
      { name: 'Закупки', children: ['Закупка товара','Аренда','Налоги','Доставка'] },
      { name: 'Команда', children: ['Выплата зарплаты','Аутсорс'] },
      { name: 'Прочее', children: ['Изъятие из кассы','Прочие расходы'] },
    ],
  };
}
function flattenTree(nodes, prefix = []) {
  const res = [];
  (nodes || []).forEach((n) => {
    const path = [...prefix, n.name];
    res.push(path.join('/'));
    (n.children || []).forEach((c) => {
      res.push([...path, c].join('/'));
    });
  });
  return res;
}

export default function CashRegistersPage() {
  const { hasAnyRole } = useAuth();
  const canManageCash = hasAnyRole(['Admin','Finance']);

  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const openToast = (severity, message) => setToast({ open: true, severity, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const [cash, setCash] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [locationId, setLocationId] = useState('');

  const [balances, setBalances] = useState({}); // { cashRegisterId: balance }
  const [balLoading, setBalLoading] = useState(false);

  const locations = useMemo(() => {
    const s = new Set();
    cash.forEach((c) => { if (c.locationId) s.add(String(c.locationId)); });
    return Array.from(s);
  }, [cash]);

  const categoriesTree = useMemo(() => readCategoriesTree(), []);
  const articlePaths = useMemo(() => {
    const roots = flattenTree(categoriesTree.income).concat(flattenTree(categoriesTree.expense));
    return roots;
  }, [categoriesTree]);

  const loadCash = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await cashService.list({ limit: 200, offset: 0 });
      const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setCash(arr.map((c) => ({
        id: String(c._id || c.id || ''),
        _id: c._id || c.id,
        name: c.name || '',
        code: c.code || '',
        defaultForLocation: !!c.defaultForLocation,
        cashierMode: !!c.cashierMode,
        locationId: c.locationId || '',
        isSystem: !!c.isSystem,
      })));
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка загрузки касс';
      setError(String(msg));
      openToast('error', String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBalances = useCallback(async () => {
    setBalLoading(true);
    try {
      const params = { limit: 2000, offset: 0 };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (locationId) params.locationId = locationId;
      const data = await paymentsService.list(params);
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      const map = new Map();
      items.forEach((it) => {
        const id = String(it.cashRegisterId || '');
        if (!id) return;
        const v = Number(it.amount || 0);
        const prev = map.get(id) || 0;
        if (it.type === 'income') map.set(id, prev + v);
        else if (it.type === 'expense') map.set(id, prev - v);
        else if (it.type === 'refund') map.set(id, prev - v);
      });
      const obj = {}; map.forEach((v, k) => { obj[k] = v; });
      setBalances(obj);
    } catch (e) {
      // silent fail for balances; show badge as 0
      console.warn('Ошибка загрузки баланса касс', e);
    } finally {
      setBalLoading(false);
    }
  }, [dateFrom, dateTo, locationId]);

  useEffect(() => { loadCash(); }, [loadCash]);
  useEffect(() => { loadBalances(); }, [loadBalances]);

  // Payment dialog state
  const [pOpen, setPOpen] = useState(false);
  const [pType, setPType] = useState('income'); // income|expense|refund
  const [pInitial, setPInitial] = useState(null);

  const openPayment = (row, type = 'income') => {
    setPType(type);
    setPInitial({ cashRegisterId: String(row._id || row.id || ''), method: 'cash' });
    setPOpen(true);
  };

  const submitPayment = async (payload) => {
    try {
      const resp = await paymentsService.create({ ...payload, type: pType });
      if (resp?.ok) {
        openToast('success', 'Платёж создан');
        setPOpen(false);
        await loadBalances();
      } else {
        throw new Error(resp?.error || 'Не удалось создать платёж');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка операции';
      openToast('error', String(msg));
    }
  };

  // Create/Edit cash register dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState({ name: '', code: '', defaultForLocation: false, cashierMode: false, locationId: '' });
  const startCreate = () => { setEditItem({ name: '', code: '', defaultForLocation: false, cashierMode: false, locationId: '' }); setEditOpen(true); };
  const startEdit = (row) => { setEditItem({ _id: row._id, name: row.name, code: row.code, defaultForLocation: !!row.defaultForLocation, cashierMode: !!row.cashierMode, locationId: row.locationId || '' }); setEditOpen(true); };
  const saveCashRegister = async () => {
    const payload = { name: editItem.name, code: editItem.code, defaultForLocation: !!editItem.defaultForLocation, cashierMode: !!editItem.cashierMode, locationId: editItem.locationId || undefined };
    try {
      let resp;
      if (editItem._id) resp = await cashService.update(String(editItem._id), payload);
      else resp = await cashService.create(payload);
      if (resp?.ok || resp?._id || resp?.id || resp?.name) {
        openToast('success', editItem._id ? 'Касса обновлена' : 'Касса создана');
        setEditOpen(false);
        await loadCash();
        await loadBalances();
      } else {
        throw new Error('Операция не удалась');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка сохранения кассы';
      openToast('error', String(msg));
    }
  };
  const deleteCashRegister = async (row) => {
    try {
      const ok = window.confirm(`Удалить кассу "${row.name}"?`);
      if (!ok) return;
      const resp = await cashService.remove(String(row._id || row.id));
      if (resp?.ok || resp?.deleted || resp === true) {
        openToast('success', 'Касса удалена');
        await loadCash();
        await loadBalances();
      } else {
        throw new Error('Не удалось удалить кассу');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка удаления кассы';
      openToast('error', String(msg));
    }
  };

  const columns = [
    { field: 'name', headerName: 'Название', width: 220 },
    { field: 'code', headerName: 'Код', width: 140 },
    { field: 'balance', headerName: 'Баланс', width: 160, valueGetter: (params) => balances[String(params.row._id || params.row.id)] || 0, valueFormatter: (p) => currency(p.value || 0), renderCell: (params) => {
      const val = balances[String(params.row._id || params.row.id)] || 0;
      return <Chip label={currency(val)} color={val >= 0 ? 'success' : 'error'} size="small" />;
    } },
    { field: 'defaultForLocation', headerName: 'По умолчанию', width: 160, valueFormatter: (p) => (p.value ? 'Да' : 'Нет'), renderCell: (params) => params.row.defaultForLocation ? <Chip label="Да" size="small" /> : <Chip label="Нет" size="small" /> },
    { field: 'cashierMode', headerName: 'Режим кассира', width: 160, valueFormatter: (p) => (p.value ? 'Да' : 'Нет'), renderCell: (params) => params.row.cashierMode ? <Chip label="Да" size="small" /> : <Chip label="Нет" size="small" /> },
    { field: 'actions', headerName: 'Действия', width: 260, renderCell: (params) => {
      const row = params.row;
      return (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<PaymentIcon />} onClick={() => openPayment(row, 'income')}>Создать платёж</Button>
          {canManageCash && (
            <>
              <Tooltip title="Редактировать">
                <IconButton size="small" onClick={() => startEdit(row)}><EditIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Удалить">
                <IconButton size="small" color="error" onClick={() => deleteCashRegister(row)}><DeleteIcon /></IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      );
    } },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Кассы</Typography>
          <Stack direction="row" spacing={1}>
            {canManageCash && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>+ Касса</Button>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePicker label="Дата с" value={dateFrom ? new Date(dateFrom) : null} onChange={(v)=>setDateFrom(v ? format(new Date(v), 'yyyy-MM-dd') : '')} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <DatePicker label="Дата по" value={dateTo ? new Date(dateTo) : null} onChange={(v)=>setDateTo(v ? format(new Date(v), 'yyyy-MM-dd') : '')} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="location-label">Локация</InputLabel>
              <Select labelId="location-label" label="Локация" value={locationId} onChange={(e)=>setLocationId(e.target.value)}>
                <MenuItem value="">Все</MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            {balLoading ? <Skeleton variant="rounded" width={140} height={28} /> : <Chip label={`Обновлено`} />}
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        <div style={{ height: 520, width: '100%' }}>
          <DataGridBase
            rows={cash}
            columns={columns}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            loading={loading}
            getRowId={(row) => row.id}
            sx={{ '& .MuiDataGrid-cell': { alignItems: 'center' } }}
          />
        </div>
      </Paper>

      <PaymentDialog
        open={pOpen}
        mode="create"
        type={pType}
        cashOptions={cash}
        articlePaths={articlePaths}
        initialPayment={pInitial || undefined}
        canSave={canManageCash}
        onClose={() => setPOpen(false)}
        onSubmit={submitPayment}
      />

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editItem._id ? 'Редактировать кассу' : 'Новая касса'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Название" value={editItem.name} onChange={(e)=>setEditItem((p)=>({ ...p, name: e.target.value }))} fullWidth />
            <TextField label="Код" value={editItem.code} onChange={(e)=>setEditItem((p)=>({ ...p, code: e.target.value }))} fullWidth />
            <TextField label="Локация" value={editItem.locationId} onChange={(e)=>setEditItem((p)=>({ ...p, locationId: e.target.value }))} fullWidth />
            <FormControlLabel control={<Checkbox checked={!!editItem.defaultForLocation} onChange={(e)=>setEditItem((p)=>({ ...p, defaultForLocation: e.target.checked }))} />} label="По умолчанию для локации" />
            <FormControlLabel control={<Checkbox checked={!!editItem.cashierMode} onChange={(e)=>setEditItem((p)=>({ ...p, cashierMode: e.target.checked }))} />} label="Режим кассира" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveCashRegister}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={2500} onClose={closeToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}