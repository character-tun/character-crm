import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Divider, IconButton, Tooltip, Alert, Snackbar } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { paymentsService } from '../services/paymentsService';
import { cashService } from '../services/cashService';
import { useAuth } from '../context/AuthContext';
import { reportsService } from '../services/reportsService';

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

  // toasts
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const openToast = (severity, message) => setToast({ open: true, severity, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  // cash registers
  const [cash, setCash] = useState([]);
  const cashMap = useMemo(() => {
    const m = new Map();
    cash.forEach((c) => m.set(String(c._id || c.id), c));
    return m;
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
  const categoriesTree = useMemo(() => readCategoriesTree(), []);
  const allArticlePaths = useMemo(() => {
    const roots = type === 'expense' ? categoriesTree.expense : type === 'income' ? categoriesTree.income : [...(categoriesTree.income||[]), ...(categoriesTree.expense||[])];
    return flattenTree(roots);
  }, [categoriesTree, type]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);

  const loadCash = async () => {
    try {
      const res = await cashService.list({ limit: 200, offset: 0 });
      const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setCash(arr);
    } catch (e) {
      console.warn('Не удалось загрузить кассы', e);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 500, offset: 0 };
      if (type) params.type = type;
      if (cashRegisterId) params.cashRegisterId = cashRegisterId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedArticles.length === 1) params.articlePath = selectedArticles[0];
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
      openToast('error', String(msg));
    } finally {
      setLoading(false);
    }
  };
  // Load cashflow report
  const loadCashflow = async () => {
    setCfLoading(true);
    setCfError('');
    try {
      const data = await reportsService.cashflow({ dateFrom, dateTo });
      setCashflowGroups(Array.isArray(data?.groups) ? data.groups : []);
      setCashflowBalance(Number(data?.balance || 0));
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка отчёта';
      setCfError(String(msg));
    } finally {
      setCfLoading(false);
    }
  };

  useEffect(() => { loadCash(); }, []);
  useEffect(() => { loadPayments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type, cashRegisterId, dateFrom, dateTo, selectedArticles.length]);
  useEffect(() => { loadCashflow(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFrom, dateTo]);

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
  const [formType, setFormType] = useState('income');
  const [form, setForm] = useState({ orderId: '', amount: 0, method: '', note: '', cashRegisterId: '', articlePath: [] });

  const openCreate = (t) => {
    setModalMode('create');
    setFormType(t);
    setForm({ orderId: '', amount: 0, method: '', note: '', cashRegisterId: '', articlePath: [] });
    setCurrentId('');
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setModalMode('edit');
    setFormType(row.type);
    setForm({ orderId: String(row.orderId || ''), amount: Number(row.amount || 0), method: row.method || '', note: row.note || '', cashRegisterId: String(row.cashRegisterId || ''), articlePath: Array.isArray(row.articlePath) ? row.articlePath : [] });
    setCurrentId(String(row._id || row.id || ''));
    setModalOpen(true);
  };
  const openRefund = () => {
    setModalMode('refund');
    setFormType('refund');
    setForm({ orderId: '', amount: 0, method: '', note: '', cashRegisterId: '', articlePath: [] });
    setCurrentId('');
    setModalOpen(true);
  };

  const submitModal = async () => {
    try {
      if (modalMode === 'create') {
        const payload = { orderId: form.orderId, type: formType, amount: Number(form.amount || 0), method: form.method || undefined, note: form.note || undefined, cashRegisterId: form.cashRegisterId || undefined, articlePath: Array.isArray(form.articlePath) ? form.articlePath : [] };
        const resp = await paymentsService.create(payload);
        if (resp?.ok) {
          openToast('success', 'Платёж создан');
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось создать платёж');
        }
      } else if (modalMode === 'edit') {
        const id = currentId;
        const patch = { amount: Number(form.amount || 0), method: form.method || undefined, note: form.note || undefined, cashRegisterId: form.cashRegisterId || undefined, articlePath: Array.isArray(form.articlePath) ? form.articlePath : [] };
        const resp = await paymentsService.update(id, patch);
        if (resp?.ok) {
          openToast('success', 'Платёж обновлён');
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось обновить платёж');
        }
      } else if (modalMode === 'refund') {
        const payload = { orderId: form.orderId, amount: Number(form.amount || 0), method: form.method || undefined, note: form.note || undefined, cashRegisterId: form.cashRegisterId || undefined, articlePath: Array.isArray(form.articlePath) ? form.articlePath : [] };
        const resp = await paymentsService.refund(payload);
        if (resp?.ok) {
          openToast('success', 'Рефанд создан');
          await loadPayments();
          setModalOpen(false);
        } else {
          throw new Error(resp?.error || 'Не удалось создать рефанд');
        }
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка операции';
      openToast('error', String(msg));
    }
  };

  const lockPayment = async (row) => {
    try {
      const resp = await paymentsService.lock(String(row._id || row.id));
      if (resp?.ok) {
        openToast('success', 'Платёж заблокирован');
        await loadPayments();
      } else {
        throw new Error(resp?.error || 'Не удалось заблокировать');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка блокировки';
      openToast('error', String(msg));
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
      </Stack>
    ) },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Платежи</Typography>
          <Stack direction="row" spacing={1}>
            {canPaymentsWrite && (
              <>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate('income')}>Новый приход</Button>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openCreate('expense')}>Новый расход</Button>
                <Button variant="outlined" color="warning" startIcon={<UndoIcon />} onClick={openRefund}>Рефанд</Button>
              </>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Cashflow mini-report widget */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Итоги по кассам</Typography>
            <Chip label={`Сальдо: ${currency(cashflowBalance)}`} color={cashflowBalance >= 0 ? 'success' : 'error'} />
          </Stack>
          {cfError && <Alert severity="error" sx={{ mt: 1 }}>{cfError}</Alert>}
          <Grid container spacing={1} sx={{ mt: 1 }}>
            {cashflowGroups.map((g) => {
              const id = String(g.cashRegisterId || '');
              const c = cashMap.get(id);
              const title = c ? `${c.name} (${c.code})` : (id ? `#${id}` : 'Без кассы');
              const t = g.totals || { income: 0, expense: 0, refund: 0, balance: 0 };
              return (
                <Grid item xs={12} md={6} lg={4} key={id || 'none'}>
                  <Paper sx={{ p: 1.5, border: '1px solid var(--color-border)' }}>
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
              <Grid item xs={12}><Typography variant="body2" sx={{ opacity: 0.7 }}>Загрузка отчёта…</Typography></Grid>
            )}
            {!cfLoading && cashflowGroups.length === 0 && !cfError && (
              <Grid item xs={12}><Typography variant="body2" sx={{ opacity: 0.7 }}>Нет данных за выбранный период</Typography></Grid>
            )}
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField type="date" label="С даты" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField type="date" label="По дату" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="type-label">Тип</InputLabel>
              <Select labelId="type-label" label="Тип" value={type} onChange={(e)=>setType(e.target.value)}>
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="income">Приход</MenuItem>
                <MenuItem value="expense">Расход</MenuItem>
                <MenuItem value="refund">Рефанд</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="cash-label">Касса</InputLabel>
              <Select labelId="cash-label" label="Касса" value={cashRegisterId} onChange={(e)=>setCashRegisterId(e.target.value)}>
                <MenuItem value="">Все</MenuItem>
                {cash.map((c) => (
                  <MenuItem key={String(c._id || c.id)} value={String(c._id || c.id)}>{c.name} ({c.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Поиск по заметке" value={noteQuery} onChange={(e)=>setNoteQuery(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="locked-label">Статус</InputLabel>
              <Select labelId="locked-label" label="Статус" value={lockedFilter} onChange={(e)=>setLockedFilter(e.target.value)}>
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="locked">Только заблокированные</MenuItem>
                <MenuItem value="unlocked">Только разблокированные</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={10}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" onClick={() => setArticleDialogOpen(true)}>Статьи</Button>
              {selectedArticles.length > 0 ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {selectedArticles.map((p) => (
                    <Chip key={p} label={p} onDelete={() => setSelectedArticles((prev) => prev.filter((x) => x !== p))} />
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
          <Box sx={{ p: 3, textAlign: 'center', color: 'var(--color-textMuted)' }}>
            <Typography>Нет данных</Typography>
          </Box>
        )}

        <div style={{ height: 520, width: '100%' }}>
          <DataGrid
            rows={filteredItems}
            columns={columns}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            loading={loading}
            getRowId={(row) => row.id}
          />
        </div>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={3} alignItems="center">
          <Chip label={`Приход: ${currency(totals.income)}`} />
          <Chip label={`Расход: ${currency(totals.expense)}`} />
          <Chip label={`Рефанд: ${currency(totals.refund)}`} />
          <Chip label={`Сальдо: ${currency(totals.balance)}`} color={totals.balance >= 0 ? 'success' : 'error'} />
        </Stack>
      </Paper>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {modalMode === 'create' ? (formType === 'income' ? 'Создать приход' : 'Создать расход') : (modalMode === 'edit' ? 'Редактировать платёж' : 'Создать рефанд')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Заказ (orderId)" value={form.orderId} onChange={(e)=>setForm((f)=>({ ...f, orderId: e.target.value }))} fullWidth />
            <TextField label="Сумма" type="number" value={form.amount} onChange={(e)=>setForm((f)=>({ ...f, amount: Number(e.target.value) }))} fullWidth />
            <TextField label="Метод" value={form.method} onChange={(e)=>setForm((f)=>({ ...f, method: e.target.value }))} fullWidth />
            <FormControl fullWidth>
              <InputLabel id="cash-edit-label">Касса</InputLabel>
              <Select labelId="cash-edit-label" label="Касса" value={form.cashRegisterId} onChange={(e)=>setForm((f)=>({ ...f, cashRegisterId: e.target.value }))}>
                <MenuItem value="">Не выбрано</MenuItem>
                {cash.map((c) => (
                  <MenuItem key={String(c._id || c.id)} value={String(c._id || c.id)}>{c.name} ({c.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Заметка" value={form.note} onChange={(e)=>setForm((f)=>({ ...f, note: e.target.value }))} fullWidth />
            <Stack>
              <Typography variant="body2" sx={{ mb: 1 }}>Статья (хлебные крошки)</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" onClick={() => setArticleDialogOpen(true)}>Выбрать из дерева</Button>
                {Array.isArray(form.articlePath) && form.articlePath.length > 0 && (
                  <Chip label={formatArticleBreadcrumbs(form.articlePath)} />
                )}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={submitModal} disabled={modalMode==='edit' && !canPaymentsWrite}>{modalMode==='edit' ? 'Сохранить' : 'Создать'}</Button>
        </DialogActions>
      </Dialog>

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
                <Stack direction="row" spacing={1} alignItems="center">
                  <input type="checkbox" checked={selectedArticles.includes(p)} onChange={(e)=>{
                    const checked = e.target.checked;
                    setSelectedArticles((prev) => {
                      const s = new Set(prev);
                      if (checked) s.add(p); else s.delete(p);
                      return Array.from(s);
                    });
                    // If choosing for modal form, also reflect single selection to form.articlePath
                    if (modalOpen) {
                      const segs = p.split('/').map((t)=>t.trim()).filter(Boolean);
                      setForm((f)=>({ ...f, articlePath: segs }));
                    }
                  }} />
                  <Typography>{p}</Typography>
                </Stack>
              </FormControl>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArticleDialogOpen(false)}>Закрыть</Button>
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