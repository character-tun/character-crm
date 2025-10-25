import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, Select, MenuItem, FormControl, FormControlLabel, InputLabel, Chip, Divider, IconButton, Tooltip, Alert, Skeleton, Checkbox } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import { paymentsService } from '../services/paymentsService';
import { cashService } from '../services/cashService';
import { useAuth } from '../context/AuthContext';
import { reportsService } from '../services/reportsService';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import DataGridBase from '../components/DataGridBase';

import PaymentDialog from '../components/PaymentDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FiltersBar from '../components/FiltersBar.jsx';
import { useSearchParams } from 'react-router-dom';

import { useNotify } from '../components/NotifyProvider';
const currency = (v) => `₽${Number(v || 0).toLocaleString('ru-RU')}`;
const formatDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleString('ru-RU') : '-';
};
const formatArticleBreadcrumbs = (path) => {
  if (Array.isArray(path)) return path.join(' / ');
  if (typeof path === 'string') return path;
  return '';
};

function readCategoriesTree() {
  try {
    const raw = localStorage.getItem('payment_categories');
    const parsed = JSON.parse(raw || 'null');
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return { income: [], expense: [] };
}
function flattenTree(nodes, prefix = []) {
  const out = [];
  (nodes || []).forEach((n) => {
    if (!n) return;
    if (typeof n === 'string') {
      out.push(prefix.concat(n).join('/'));
    } else if (typeof n === 'object') {
      const name = n.name || '';
      const children = Array.isArray(n.children) ? n.children : [];
      if (!children.length) {
        out.push(prefix.concat(name).join('/'));
      } else {
        children.forEach((c) => {
          if (typeof c === 'string') out.push(prefix.concat(name, c).join('/'));
          else if (c && typeof c === 'object') out.push(...flattenTree([c], prefix.concat(name)));
        });
      }
    }
  });
  return out;
}
function matchesArticle(item, selected) {
  if (!selected || selected.length === 0) return true;
  const ip = Array.isArray(item.articlePath) ? item.articlePath.map(String) : [];
  return selected.some((s) => {
    const segs = String(s).split('/').map((t) => t.trim()).filter(Boolean);
    if (segs.length === 0) return false;
    // prefix match by indices
    const prefixOk = segs.every((val, idx) => (ip[idx] || '') === val);
    // segment contained match
    const segmentOk = segs.some((val) => ip.includes(val));
    return prefixOk || segmentOk;
  });
}

export default function PaymentsPage() {
  const { hasAnyRole } = useAuth();
  const canPaymentsWrite = hasAnyRole(['Admin','Finance']);
  const canPaymentsLock = hasAnyRole(['Admin','Finance']);
  const canPaymentsDelete = hasAnyRole(['Admin']);

  // toasts
  const notify = useNotify();
  // using centralized notifications

  // cash registers
  const [cash, setCash] = useState([]);
  const cashMap = useMemo(() => {
    const m = new Map();
    cash.forEach((c) => m.set(String(c._id || c.id), c));
    return m;
  }, [cash]);
  const locations = useMemo(() => {
    const s = new Set();
    cash.forEach((c) => { if (c.locationId) s.add(String(c.locationId)); });
    return Array.from(s);
  }, [cash]);

  // server items
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverTotals, setServerTotals] = useState({ income: 0, expense: 0, refund: 0, balance: 0 });
  // Cashflow mini-report state
  const [cashflowGroups, setCashflowGroups] = useState([]);
  const [cashflowBalance, setCashflowBalance] = useState(0);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState(''); // '', 'income', 'expense', 'refund'
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [lockedFilter, setLockedFilter] = useState('all'); // 'all' | 'locked' | 'unlocked'
  const [locationId, setLocationId] = useState('');
  const categoriesTree = useMemo(() => readCategoriesTree(), []);
  const allArticlePaths = useMemo(() => {
    const roots = type === 'expense' ? categoriesTree.expense : type === 'income' ? categoriesTree.income : [...(categoriesTree.income||[]), ...(categoriesTree.expense||[])];
    return flattenTree(roots);
  }, [categoriesTree, type]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  React.useEffect(() => {
    const p = Object.fromEntries(searchParams.entries());
    if (p.dateFrom) setDateFrom(p.dateFrom);
    if (p.dateTo) setDateTo(p.dateTo);
    if (p.cashRegisterId) setCashRegisterId(p.cashRegisterId);
    if (p.locationId) setLocationId(p.locationId);
    if (p.q) setNoteQuery(p.q);
    if (p.articlePath) setSelectedArticles([p.articlePath]);
  }, []);
  React.useEffect(() => {
    const q = {};
    if (dateFrom) q.dateFrom = dateFrom;
    if (dateTo) q.dateTo = dateTo;
    if (cashRegisterId) q.cashRegisterId = cashRegisterId;
    if (locationId) q.locationId = locationId;
    if (noteQuery) q.q = noteQuery;
    if (selectedArticles.length === 1) q.articlePath = selectedArticles[0];
    setSearchParams(q, { replace: true });
  }, [dateFrom, dateTo, cashRegisterId, locationId, noteQuery, selectedArticles]);

  const loadCash = async () => {
    try {
      const res = await cashService.list({ limit: 200, offset: 0 });
      const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setCash(arr);
    } catch (e) {
      console.warn('Не удалось загрузить кассы', e);
    }
  };

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 500, offset: 0 };
      if (type) params.type = type;
      if (cashRegisterId) params.cashRegisterId = cashRegisterId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedArticles.length === 1) params.articlePath = selectedArticles[0];
      if (locationId) params.locationId = locationId;
      const data = await paymentsService.list(params);
      const arr = Array.isArray(data?.items) ? data.items : [];
      setItems(arr.map((it) => ({
        id: String(it._id || it.id || ''),
        _id: it._id || it.id,
        type: it.type,
        articlePath: Array.isArray(it.articlePath) ? it.articlePath : (typeof it.articlePath === 'string' ? it.articlePath.split('/').map((t)=>t.trim()).filter(Boolean) : []),
        amount: Number(it.amount || 0),
        method: it.method || '',
        cashRegisterId: it.cashRegisterId || '',
        orderId: it.orderId || '',
        note: it.note || '',
        locked: !!it.locked,
        createdAt: it.createdAt || it.date || null,
      })));
      setServerTotals(data?.totals || { income: 0, expense: 0, refund: 0, balance: 0 });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка загрузки платежей';
      setError(String(msg));
      notify(String(msg), { severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [type, cashRegisterId, dateFrom, dateTo, selectedArticles, locationId]);
  // Load cashflow report
  const loadCashflow = useCallback(async () => {
    setCfLoading(true);
    setCfError('');
    try {
      const data = await reportsService.cashflow({ dateFrom, dateTo, locationId });
      setCashflowGroups(Array.isArray(data?.groups) ? data.groups : []);
      setCashflowBalance(Number(data?.balance || 0));
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка отчёта';
      setCfError(String(msg));
    } finally {
      setCfLoading(false);
    }
  }, [dateFrom, dateTo, locationId]);

  useEffect(() => { loadCash(); }, []);
  useEffect(() => { loadPayments(); }, [loadPayments]);
  useEffect(() => { loadCashflow(); }, [loadCashflow]);

  const filteredItems = useMemo(() => {
    let arr = items.slice();
    if (lockedFilter === 'locked') arr = arr.filter((i) => i.locked);
    else if (lockedFilter === 'unlocked') arr = arr.filter((i) => !i.locked);
    if (noteQuery) {
      const q = noteQuery.toLowerCase();
      arr = arr.filter((i) => String(i.note || '').toLowerCase().includes(q));
    }
    if (selectedArticles.length > 1 || selectedArticles.length === 0) {
      // apply client-side article filter when multi-select or none (server handled single)
      arr = arr.filter((i) => matchesArticle(i, selectedArticles));
    }
    return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [items, lockedFilter, noteQuery, selectedArticles]);

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, refund: 0 };
    filteredItems.forEach((it) => {
      const v = Number(it.amount || 0);
      if (it.type === 'income') t.income += v;
      else if (it.type === 'expense') t.expense += v;
      else if (it.type === 'refund') t.refund += v;
    });
    return { ...t, balance: t.income - t.expense - t.refund };
  }, [filteredItems]);

  // create / edit / refund dialogs
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'refund'
  const [currentId, setCurrentId] = useState('');
  const [currentRow, setCurrentRow] = useState(null);
  const [formType, setFormType] = useState('income');

  const openCreate = (t) => {
    setModalMode('create');
    setFormType(t);
    setCurrentId('');
    setCurrentRow(null);
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setModalMode('edit');
    setFormType(row.type);
    setCurrentId(String(row._id || row.id || ''));
    setCurrentRow(row);
    setModalOpen(true);
  };
  const openRefund = () => {
    setModalMode('refund');
    setFormType('refund');
    setCurrentId('');
    setCurrentRow(null);
    setModalOpen(true);
  };

  const submitModal = async (payload) => {
    try {
      if (modalMode === 'create') {
        const resp = await paymentsService.create({ ...payload, type: formType });
        if (resp?.ok) {
          notify('Платёж создан', { severity: 'success' });
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось создать платёж');
        }
      } else if (modalMode === 'edit') {
        const id = currentId;
        const { amount, method, note, cashRegisterId, articlePath } = payload || {};
        const patch = { amount: Number(amount || 0), method: method || undefined, note: note || undefined, cashRegisterId: cashRegisterId || undefined, articlePath: Array.isArray(articlePath) ? articlePath : [] };
        const resp = await paymentsService.update(id, patch);
        if (resp?.ok) {
          notify('Платёж обновлён', { severity: 'success' });
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось обновить платёж');
        }
      } else if (modalMode === 'refund') {
        const resp = await paymentsService.refund(payload);
        if (resp?.ok) {
          notify('Рефанд создан', { severity: 'success' });
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось создать рефанд');
        }
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка операции';
      notify(String(msg), { severity: 'error' });
    }
  };

  const lockPayment = async (row) => {
    try {
      const resp = await paymentsService.lock(String(row._id || row.id));
      if (resp?.ok) {
        notify('Платёж заблокирован', { severity: 'success' });
        await loadPayments();
      } else {
        throw new Error(resp?.error || 'Не удалось заблокировать');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка блокировки';
      notify(String(msg), { severity: 'error' });
    }
  };

  const deletePayment = async (row) => {
    try {
      const ok = window.confirm('Удалить платёж? Это действие необратимо.');
      if (!ok) return;
      const resp = await paymentsService.remove(String(row._id || row.id));
      if (resp?.ok) {
        notify('Платёж удалён', { severity: 'success' });
        await loadPayments();
      } else {
        throw new Error(resp?.error || 'Не удалось удалить платёж');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка удаления';
      notify(String(msg), { severity: 'error' });
    }
  };

  const columns = [
    { field: 'createdAt', headerName: 'Дата', width: 180, valueGetter: (params) => params.row.createdAt, valueFormatter: (params) => formatDateTime(params.value) },
    { field: 'type', headerName: 'Тип', width: 120, valueFormatter: (p) => ({ income: 'Приход', expense: 'Расход', refund: 'Рефанд' }[p.value] || p.value) },
    { field: 'articlePath', headerName: 'Статья', width: 240, valueFormatter: (p) => formatArticleBreadcrumbs(p.value) },
    { field: 'amount', headerName: 'Сумма', width: 130, valueFormatter: (p) => currency(p.value) },
    { field: 'method', headerName: 'Метод', width: 160 },
    { field: 'cashRegisterId', headerName: 'Касса', width: 200, valueFormatter: (p) => {
      const id = String(p.value || '');
      const c = cashMap.get(id);
      if (!c) return id ? `#${id}` : '';
      const code = c.code || '';
      const name = c.name || '';
      return code && name ? `${name} (${code})` : (name || code || id);
    } },
    { field: 'orderId', headerName: 'Заказ', width: 160 },
    { field: 'note', headerName: 'Комментарий', width: 240 },
    { field: 'locked', headerName: 'Замок', width: 100, renderCell: (params) => (
      params.row.locked ? (
        <Tooltip title="Платёж закрыт"><LockIcon fontSize="small" /></Tooltip>
      ) : (
        <Tooltip title={canPaymentsLock ? 'Заблокировать платёж' : 'Нет прав'}>
          <span>
            <IconButton size="small" disabled={!canPaymentsLock} onClick={() => lockPayment(params.row)}><LockOpenIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
      )
    ) },
    { field: 'actions', headerName: 'Действия', width: 120, sortable: false, filterable: false, renderCell: (params) => (
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={params.row.locked ? 'Платёж закрыт' : (canPaymentsWrite ? 'Редактировать' : 'Нет прав')}>
          <span>
            <IconButton size="small" disabled={params.row.locked || !canPaymentsWrite} onClick={() => openEdit(params.row)}><EditIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title={params.row.locked ? 'Платёж закрыт' : (canPaymentsDelete ? 'Удалить' : 'Нет прав')}>
          <span>
            <IconButton size="small" disabled={params.row.locked || !canPaymentsDelete} onClick={() => deletePayment(params.row)}><DeleteIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
      </Stack>
    ) },
  ];

  return (
    <Box sx={{ p: 2 }} data-tour="payments-root">
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" data-tour="payments-title">Платежи</Typography>
          <Stack direction="row" spacing={1}>
             {canPaymentsWrite && (
               <>
                <Tooltip title="Создать приход">
                  <span>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate('income')} data-tour="payments-new-income">Новый приход</Button>
                  </span>
                </Tooltip>
                <Tooltip title="Создать расход">
                  <span>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openCreate('expense')} data-tour="payments-new-expense">Новый расход</Button>
                  </span>
                </Tooltip>
                <Tooltip title="Оформить рефанд">
                  <span>
                    <Button variant="outlined" color="warning" startIcon={<UndoIcon />} onClick={openRefund} data-tour="payments-refund">Рефанд</Button>
                  </span>
                </Tooltip>
               </>
             )}
           </Stack>
         </Stack>
 
         <Divider sx={{ my: 2 }} />
 
        {/* Cashflow mini-report widget */}
        <Box sx={{ mb: 2 }} data-tour="payments-cashflow-widget">
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Итоги по кассам</Typography>
            {cfLoading ? (
              <Skeleton variant="rounded" width={140} height={28} />
            ) : (
              <Chip label={`Сальдо: ${currency(cashflowBalance)}`} color={cashflowBalance >= 0 ? 'success' : 'error'} data-tour="payments-cashflow-balance" />
            )}
          </Stack>
          {cfError && <Alert severity="error" sx={{ mt: 1 }}>{cfError}</Alert>}
          <Grid container spacing={1} sx={{ mt: 1 }}>
             {!cfLoading && cashflowGroups.map((g) => {
               const id = String(g.cashRegisterId || '');
               const c = cashMap.get(id);
               const title = c ? `${c.name} (${c.code})` : (id ? `#${id}` : 'Без кассы');
               const t = g.totals || { income: 0, expense: 0, refund: 0, balance: 0 };
               return (
                 <Grid item xs={12} md={6} lg={4} key={id || 'none'}>
                   <Paper sx={{ p: 1.5, border: '1px solid var(--color-border)', minHeight: 96 }}>
                     <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
                     </Stack>
                     <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                       <Chip label={`Приход: ${currency(t.income)}`} size="small" />
                       <Chip label={`Расход: ${currency(t.expense)}`} size="small" />
                       <Chip label={`Рефанд: ${currency(t.refund)}`} size="small" />
                       <Chip label={`Сальдо: ${currency(t.balance)}`} size="small" color={t.balance >= 0 ? 'success' : 'error'} />
                     </Stack>
                   </Paper>
                 </Grid>
               );
             })}
             {cfLoading && (
               <>
                 {[0,1,2].map((i) => (
                   <Grid item xs={12} md={6} lg={4} key={`sk-${i}`}>
                     <Paper sx={{ p: 1.5, border: '1px solid var(--color-border)', minHeight: 96 }}>
                       <Skeleton variant="text" width="60%" height={24} />
                       <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                         <Skeleton variant="rounded" width={88} height={28} />
                         <Skeleton variant="rounded" width={88} height={28} />
                         <Skeleton variant="rounded" width={88} height={28} />
                         <Skeleton variant="rounded" width={88} height={28} />
                       </Stack>
                     </Paper>
                   </Grid>
                 ))}
               </>
             )}
             {!cfLoading && cashflowGroups.length === 0 && !cfError && (
               <Grid item xs={12}><Typography variant="body2" sx={{ opacity: 0.7 }}>Нет данных за выбранный период</Typography></Grid>
             )}
           </Grid>
         </Box>
 
         {/* FiltersBar: unified filters */}
         <FiltersBar
           value={{
             dateFrom,
             dateTo,
             cashRegisterId,
             article: selectedArticles.length === 1 ? selectedArticles[0] : '',
             locationId,
             q: noteQuery,
           }}
           onChange={(next) => {
             if (Object.prototype.hasOwnProperty.call(next, 'dateFrom')) setDateFrom(next.dateFrom || '');
             if (Object.prototype.hasOwnProperty.call(next, 'dateTo')) setDateTo(next.dateTo || '');
             if (Object.prototype.hasOwnProperty.call(next, 'cashRegisterId')) setCashRegisterId(next.cashRegisterId || '');
             if (Object.prototype.hasOwnProperty.call(next, 'locationId')) setLocationId(next.locationId || '');
             if (Object.prototype.hasOwnProperty.call(next, 'q')) setNoteQuery(next.q || '');
             if (Object.prototype.hasOwnProperty.call(next, 'article')) setSelectedArticles(next.article ? [next.article] : []);
           }}
           cashRegisters={cash}
           locations={locations}
           articles={allArticlePaths}
         />

         {/* Additional non-unified filters */}
         <Grid container spacing={2} sx={{ mt: 1 }}>
           <Grid item xs={12} md={2}>
              <FormControl fullWidth data-tour="payments-type-filter">
                <InputLabel id="type-label">Тип</InputLabel>
                <Select labelId="type-label" label="Тип" value={type} onChange={(e)=>setType(e.target.value)}>
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="income">Приход</MenuItem>
                  <MenuItem value="expense">Расход</MenuItem>
                  <MenuItem value="refund">Рефанд</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth data-tour="payments-status-filter">
                <InputLabel id="locked-label">Статус</InputLabel>
                <Select labelId="locked-label" label="Статус" value={lockedFilter} onChange={(e)=>setLockedFilter(e.target.value)}>
                  <MenuItem value="all">Все</MenuItem>
                  <MenuItem value="locked">Только заблокированные</MenuItem>
                  <MenuItem value="unlocked">Только разблокированные</MenuItem>
                </Select>
              </FormControl>
            </Grid>
         </Grid>
 
         <Grid container spacing={2} sx={{ mt: 1 }}>
           <Grid item xs={12}>
             <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" onClick={() => setArticleDialogOpen(true)} data-tour="payments-articles-filter">Статьи</Button>
               <Typography variant="body2" sx={{ opacity: 0.8 }}>Выбранные: {selectedArticles.length || 0}</Typography>
             </Stack>
           </Grid>
         </Grid>
 
         <Grid container spacing={2} sx={{ mt: 1 }}>
           <Grid item xs={12}>
             <Stack spacing={1}>
               {selectedArticles.length > 0 ? (
                 <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                   {selectedArticles.map((p) => (
                    <Chip key={p} label={p} onDelete={() => setSelectedArticles((prev) => prev.filter((x) => x !== p))} data-tour="payments-selected-articles" />
                   ))}
                 </Stack>
               ) : (
                 <Typography variant="body2" sx={{ opacity: 0.7 }}>Фильтр по статьям не выбран</Typography>
               )}
             </Stack>
           </Grid>
         </Grid>
 
         <Divider sx={{ my: 2 }} />
 
         {error && (
           <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
         )}
 
         {filteredItems.length === 0 && !loading && (
          <EmptyState
            title="Нет данных"
            description="Измените фильтры или создайте платёж."
            actionLabel={canPaymentsWrite ? (type === 'expense' ? 'Новый расход' : 'Новый приход') : undefined}
            onAction={canPaymentsWrite ? () => openCreate(type === 'expense' ? 'expense' : 'income') : undefined}
          />
        )}
 
         <div style={{ height: 520, width: '100%' }} data-tour="payments-grid">
           <DataGridBase
             rows={filteredItems}
             columns={columns}
             pageSizeOptions={[25, 50, 100]}
             initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
             loading={loading}
             getRowId={(row) => row.id}
             onRowClick={(params) => openEdit(params.row)}
             getRowClassName={(params) => {
               const t = params.row.type;
               if (t === 'income') return 'row-income';
               if (t === 'expense') return 'row-expense';
               if (t === 'refund') return 'row-refund';
               return '';
             }}
             sx={{
               '& .row-income': { bgcolor: 'rgba(76, 175, 80, 0.10)' },
               '& .row-expense': { bgcolor: 'rgba(244, 67, 54, 0.10)' },
               '& .row-refund': { bgcolor: 'rgba(255, 152, 0, 0.10)' }
             }}
           />
         </div>
 
         <Divider sx={{ my: 2 }} />
 
         <Stack direction="row" spacing={3} alignItems="center" sx={{ minHeight: 36 }} data-tour="payments-totals">
           {loading ? (
             <>
               <Skeleton variant="rounded" width={140} height={28} />
               <Skeleton variant="rounded" width={140} height={28} />
               <Skeleton variant="rounded" width={140} height={28} />
               <Skeleton variant="rounded" width={140} height={28} />
             </>
           ) : (
             <>
               <Chip label={`Приход: ${currency(totals.income)}`} />
               <Chip label={`Расход: ${currency(totals.expense)}`} />
               <Chip label={`Рефанд: ${currency(totals.refund)}`} />
               <Chip label={`Сальдо: ${currency(totals.balance)}`} color={totals.balance >= 0 ? 'success' : 'error'} />
             </>
           )}
         </Stack>
       </Paper>
 
       <PaymentDialog
        open={modalOpen}
        mode={modalMode}
        type={formType}
        cashOptions={cash}
        categoriesTree={categoriesTree}
        articlePaths={allArticlePaths}
        initialPayment={modalMode === 'edit' ? currentRow : undefined}
        canSave={modalMode !== 'edit' || canPaymentsWrite}
        onClose={() => setModalOpen(false)}
        onSubmit={submitModal}
      />
 
       <Dialog open={articleDialogOpen} onClose={() => setArticleDialogOpen(false)} fullWidth maxWidth="sm">
         <DialogTitle>Выбор статей</DialogTitle>
         <DialogContent>
           <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>Отметьте одну или несколько статей</Typography>
           <Stack spacing={1}>
             {allArticlePaths.length === 0 && (
               <Typography sx={{ opacity: 0.7 }}>Здесь пока пусто</Typography>
             )}
             {allArticlePaths.map((p) => (
               <FormControl key={p}>
                 <FormControlLabel
                   control={<Checkbox checked={selectedArticles.includes(p)} onChange={(e)=>{
                     const checked = e.target.checked;
                     setSelectedArticles((prev) => {
                       const s = new Set(prev);
                       if (checked) s.add(p); else s.delete(p);
                       return Array.from(s);
                     });
                     // модалка использует собственный выбор статьи; фильтры — только в этой панели
                   }} />}
                   label={p}
                 />
               </FormControl>
             ))}
           </Stack>
         </DialogContent>
         <DialogActions>
           <Button onClick={() => setArticleDialogOpen(false)}>Закрыть</Button>
         </DialogActions>
       </Dialog>
 
       </Box>
   );
 }