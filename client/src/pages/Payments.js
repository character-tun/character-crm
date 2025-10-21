import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Divider, IconButton } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useLocation } from 'react-router-dom';

const LS_PAYMENTS_KEY = 'payments';

const currency = (v) => `₽${Number(v || 0).toLocaleString('ru-RU')}`;
const genId = (prefix = 'pay') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const METHODS = ['Наличные', 'Карта', 'Банковский перевод'];

const getDocumentTemplate = (key, fallback) => {
  try {
    const raw = localStorage.getItem('document_templates');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && obj[key]) return obj[key];
    }
  } catch {}
  return fallback;
};

const renderTemplate = (tpl, ctx) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] ?? ''));

const defaultReceiptTemplate = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Квитанция</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 24px; }
    h2 { margin: 0 0 12px; }
    .meta { margin: 6px 0; }
    .line { display: flex; justify-content: space-between; margin: 4px 0; }
    .muted { opacity: 0.7; }
    hr { border: none; border-top: 1px solid var(--color-border); margin: 12px 0; }
  </style>
</head>
<body>
  <h2>Квитанция — {{typeLabel}}</h2>
  <div class="meta">Дата: {{date}}</div>
  <hr />
  <div class="line"><div>Сумма</div><div><b>{{amount}}</b></div></div>
  <div class="line"><div>Метод</div><div>{{method}}</div></div>
  <div class="line"><div>Статья</div><div>{{article}}</div></div>
  <div class="line"><div>Основание</div><div>{{basis}}</div></div>
  <div class="line"><div>Описание</div><div>{{description}}</div></div>
  <div class="line"><div>Сотрудник</div><div>{{employee}}</div></div>
  <hr />
  <div class="muted">Сформировано системой CRM</div>
</body>
</html>`;

const LS_CATEGORIES_KEY = 'payment_categories';

function normalizeCategories(raw) {
  try {
    const parsed = JSON.parse(raw || 'null');
    if (!parsed) return { income: [], expense: [] };
    // Новый формат: дерево {income:[{name,children}], expense:[...]}
    if (typeof parsed === 'object' && Array.isArray(parsed.income) && parsed.income.every(x => typeof x === 'object')) {
      return parsed;
    }
    // Старый объект: строки в массиве -> оборачиваем в одну категорию
    if (typeof parsed === 'object') {
      return {
        income: [{ name: 'Без категории (доход)', children: Array.isArray(parsed.income) ? parsed.income : [] }],
        expense: [{ name: 'Без категории (расход)', children: Array.isArray(parsed.expense) ? parsed.expense : [] }],
      };
    }
    // Плоский массив
    if (Array.isArray(parsed)) {
      return { income: [{ name: 'Без категории (доход)', children: parsed }], expense: [] };
    }
  } catch {}
  return { income: [], expense: [] };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_PAYMENTS_KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(LS_PAYMENTS_KEY, JSON.stringify(payments));
  }, [payments]);

  // Подтягиваем методы и категории из настроек
  const availableMethods = useMemo(() => {
    try {
      const raw = localStorage.getItem('payment_methods');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return METHODS;
  }, []);

  const availableCategories = useMemo(() => {
    try {
      const raw = localStorage.getItem('payment_categories');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        const inc = Array.isArray(parsed.income) ? parsed.income : [];
        const exp = Array.isArray(parsed.expense) ? parsed.expense : [];
        return [...inc, ...exp];
      }
    } catch {}
    return [];
  }, []);

  const totals = useMemo(() => {
    const income = payments.filter((p) => p.type === 'income').reduce((s, p) => s + Number(p.amount || 0), 0);
    const expense = payments.filter((p) => p.type === 'expense').reduce((s, p) => s + Number(p.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [payments]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' | 'edit'
  const [draftType, setDraftType] = useState('income'); // 'income' | 'expense'
  const [draft, setDraft] = useState({ amount: 0, method: METHODS[0], article: '', basis: '', description: '', receipt: 'Нет', employee: 'vblazhenov', date: new Date().toISOString(), client: '', orderId: '' });
  const [editId, setEditId] = useState(null);
  const location = useLocation();

  // Категории/подкатегории (иерархия)
  const categoriesTree = useMemo(() => normalizeCategories(localStorage.getItem(LS_CATEGORIES_KEY)), [dialogOpen, draftType]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  useEffect(() => { setSelectedSubcategory(''); }, [selectedCategory]);
  useEffect(() => {
    if (!dialogOpen) return;
    const cats = draftType === 'income' ? (categoriesTree.income || []) : (categoriesTree.expense || []);
    const article = draft.article || '';
    let catName = cats[0]?.name || '';
    let subName = '';
    for (const c of cats) {
      if (c.name === article) { catName = c.name; subName = ''; break; }
      if ((c.children || []).includes(article)) { catName = c.name; subName = article; break; }
    }
    setSelectedCategory(catName);
    setSelectedSubcategory(subName);
  }, [dialogOpen, draftType, categoriesTree, draft.article]);

  const openCreate = (type) => {
    setDialogMode('create');
    setDraftType(type);
    const sp = new URLSearchParams(location.search);
    const clientQ = sp.get('client') || '';
    const orderQ = sp.get('order') || '';
    setDraft({ amount: 0, method: (availableMethods[0] || METHODS[0]), article: '', basis: orderQ ? `Оплата заказа ${orderQ}` : '', description: '', receipt: 'Нет', employee: 'vblazhenov', date: new Date().toISOString(), client: clientQ, orderId: orderQ });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setDialogMode('edit');
    setDraftType(row.type || 'income');
    setDraft({
      amount: Number(row.amount || 0),
      method: row.method || (availableMethods[0] || METHODS[0]),
      article: row.article || '',
      basis: row.basis || '',
      description: row.description || '',
      receipt: row.receipt || 'Нет',
      employee: row.employee || 'vblazhenov',
      date: row.date || new Date().toISOString(),
      client: row.client || '',
      orderId: row.orderId || '',
    });
    setEditId(row.id);
    setDialogOpen(true);
  };

  const saveDraft = () => {
    const amount = Number(draft.amount || 0);
    if (!amount || amount < 0) return;
    const chosenArticle = selectedSubcategory || selectedCategory || draft.article;
    const payload = { id: editId || genId('pay'), type: draftType, amount, method: draft.method, article: chosenArticle, basis: draft.basis, description: draft.description, receipt: draft.receipt, employee: draft.employee, date: draft.date, client: draft.client, orderId: draft.orderId };
    if (dialogMode === 'create') setPayments((prev) => [payload, ...prev]);
    else setPayments((prev) => prev.map((p) => (p.id === editId ? { ...payload } : p)));
    setDialogOpen(false);
    setEditId(null);
  };

  const handleDelete = (row) => {
    if (!window.confirm('Удалить этот платеж?')) return;
    setPayments((prev) => prev.filter((p) => p.id !== row.id));
  };

  const printPayment = (row) => {
    const ctx = {
      typeLabel: row.type === 'income' ? 'Приход' : 'Расход',
      date: new Date(row.date).toLocaleString('ru-RU'),
      amount: currency(row.amount),
      method: row.method || '-',
      article: row.article || '-',
      basis: row.basis || '-',
      description: row.description || '-',
      employee: row.employee || '-',
      // extended variables
      receipt: row.receipt || 'Нет',
      client: row.client || '-',
      orderId: row.orderId || '-',
      currency: '₽',
    };
    const tpl = getDocumentTemplate('payment_receipt', defaultReceiptTemplate);
    const html = renderTemplate(tpl, ctx);
    const w = window.open('', 'PRINT', 'height=600,width=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const exportCSV = () => {
    const headers = ['Дата', 'Тип', 'Сумма', 'Метод', 'Статья', 'Основание', 'Описание', 'Сотрудник', 'Чек', 'Клиент', 'Заказ', 'ID'];
    const rows = payments.map((p) => [new Date(p.date).toLocaleString('ru-RU'), p.type, p.amount, p.method, p.article || '', p.basis || '', p.description || '', p.employee || '', p.receipt || '', p.client || '', p.orderId || '', p.id]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((x) => (String(x).includes(',') ? `"${String(x).replace(/"/g, '""')}"` : x)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'payments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { field: 'date', headerName: 'Дата', width: 180, valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU') },
    { field: 'income', headerName: 'Приход', width: 130, valueGetter: (params) => params.row.type === 'income' ? params.row.amount : null, valueFormatter: (params) => params.value ? currency(params.value) : '' },
    { field: 'expense', headerName: 'Расход', width: 130, valueGetter: (params) => params.row.type === 'expense' ? params.row.amount : null, valueFormatter: (params) => params.value ? currency(params.value) : '' },
    { field: 'method', headerName: 'Метод', width: 160 },
    { field: 'article', headerName: 'Статья', width: 220 },
    { field: 'basis', headerName: 'Основание', width: 220 },
    { field: 'description', headerName: 'Описание', width: 240 },
    { field: 'employee', headerName: 'Создал', width: 160 },
    { field: 'receipt', headerName: 'Чек', width: 110 },
    { field: 'client', headerName: 'Клиент', width: 200 },
    { field: 'orderId', headerName: 'Заказ', width: 140 },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => openEdit(params.row)} aria-label="edit"><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row)} aria-label="delete"><DeleteIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => printPayment(params.row)} aria-label="print"><PrintIcon fontSize="small" /></IconButton>
        </Stack>
      ),
    },
  ];

  const filteredPayments = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const clientQ = (sp.get('client') || '').trim().toLowerCase();
    const orderQ = (sp.get('order') || '').trim().toLowerCase();
    let res = payments;
    if (clientQ) res = res.filter((p) => (p.client || '').toLowerCase().includes(clientQ));
    if (orderQ) res = res.filter((p) => (p.orderId || '').toLowerCase() === orderQ);
    return res;
  }, [payments, location.search]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Платежи</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}><Typography>Приход: <b>{currency(totals.income)}</b></Typography></Grid>
          <Grid item xs={12} sm={6} md={4}><Typography>Расход: <b>{currency(totals.expense)}</b></Typography></Grid>
          <Grid item xs={12} sm={12} md={4}><Typography>Итого: <b>{currency(totals.net)}</b></Typography></Grid>
        </Grid>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => openCreate('income')}>Создать приход</Button>
          <Button variant="outlined" onClick={() => openCreate('expense')}>Создать расход</Button>
          <Button variant="text" startIcon={<FileDownloadIcon />} onClick={exportCSV}>Экспорт CSV</Button>
        </Stack>
      </Paper>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={filteredPayments}
          columns={columns}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'create' ? (draftType === 'income' ? 'Создать приход' : 'Создать расход') : 'Редактировать платеж'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="method-label">Метод</InputLabel>
                <Select labelId="method-label" label="Метод" value={draft.method} onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value }))}>
                  {availableMethods.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Сумма, ₽" type="number" fullWidth value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value || 0) }))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="receipt-label">Чек</InputLabel>
                <Select labelId="receipt-label" label="Чек" value={draft.receipt} onChange={(e) => setDraft((d) => ({ ...d, receipt: e.target.value }))}>
                  <MenuItem value="Да">Да</MenuItem>
                  <MenuItem value="Нет">Нет</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Клиент" fullWidth value={draft.client} onChange={(e) => setDraft((d) => ({ ...d, client: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Заказ" fullWidth value={draft.orderId} onChange={(e) => setDraft((d) => ({ ...d, orderId: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              {((categoriesTree.income || []).length || (categoriesTree.expense || []).length) ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="category-label">Категория</InputLabel>
                      <Select labelId="category-label" label="Категория" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        {(draftType === 'income' ? (categoriesTree.income || []) : (categoriesTree.expense || [])).map((c) => (
                          <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="subcategory-label">Подкатегория</InputLabel>
                      <Select labelId="subcategory-label" label="Подкатегория" value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} disabled={!selectedCategory}>
                        {(((draftType === 'income' ? (categoriesTree.income || []) : (categoriesTree.expense || [])).find((c) => c.name === selectedCategory)?.children) || []).map((s) => (
                          <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              ) : (
                <TextField label="Статья" fullWidth value={draft.article} onChange={(e) => setDraft((d) => ({ ...d, article: e.target.value }))} />
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField label="Основание" fullWidth value={draft.basis} onChange={(e) => setDraft((d) => ({ ...d, basis: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Описание" fullWidth multiline minRows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Сотрудник" fullWidth value={draft.employee} onChange={(e) => setDraft((d) => ({ ...d, employee: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Дата" type="datetime-local" fullWidth value={new Date(draft.date).toISOString().slice(0,16)} onChange={(e) => setDraft((d) => ({ ...d, date: new Date(e.target.value).toISOString() }))} />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1}>
                <Chip label={draftType === 'income' ? 'Приход' : 'Расход'} color={draftType === 'income' ? 'success' : 'error'} />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveDraft} disabled={Number(draft.amount || 0) <= 0}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}