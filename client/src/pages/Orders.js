import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Select, InputLabel, FormControl, Divider, List, ListItem, ListItemText, Chip, Stack, IconButton, Checkbox } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid } from '@mui/x-data-grid';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import OrderTimeline from '../components/OrderTimeline';
// import OrderTimeline from '../components/OrderTimeline';
 import http from '../services/http';
import { orderTypesService } from '../services/orderTypesService';
import { getStatuses } from '../services/statusesService';

const formatCurrency = (value) => `₽${Number(value || 0).toLocaleString('ru-RU')}`;

const ALL_TYPES = ['Детали', 'Детейлинг', 'Кузовной ремонт'];

// Справочники: услуги, исполнители, статусы
const SERVICES = [
  { name: 'Антискол на стекла', price: 5000 },
  { name: 'Локальный окрас повреждений', price: 16000 },
  { name: 'Полировка кузова', price: 12000 },
  { name: 'Замена стекла', price: 8000 },
];

const PERFORMERS = ['vblazhenov', 'manager1', 'worker1'];
const ORDER_STATUSES = ['Новый', 'В работе', 'Готов', 'Отменён'];

const initialOrders = [
  {
    id: 'ORD-1001',
    client: 'Иван Петров',
    types: ['Детейлинг'],
    status: 'В работе',
    startDate: new Date('2025-10-10T10:00:00'),
    endDateForecast: new Date('2025-10-12T18:00:00'),
    amount: 45000,
    paid: 30000,
    profit: 15000,
  },
  {
    id: 'ORD-1002',
    client: 'Анна Сидорова',
    types: ['Детали', 'Детейлинг'],
    status: 'Новый',
    startDate: new Date('2025-10-14T09:00:00'),
    endDateForecast: new Date('2025-10-15T18:00:00'),
    amount: 52000,
    paid: 20000,
    profit: 22000,
  },
  {
    id: 'ORD-1003',
    client: 'Сергей Иванов',
    types: ['Кузовной ремонт'],
    status: 'Готов',
    startDate: new Date('2025-10-05T11:00:00'),
    endDateForecast: new Date('2025-10-20T18:00:00'),
    amount: 120000,
    paid: 90000,
    profit: 25000,
  },
];

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

const defaultOrderTemplate = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Заказ</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 24px; }
    h2 { margin: 0 0 12px; }
    .meta { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    .right { text-align: right; }
    hr { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
    .muted { opacity: 0.7; }
  </style>
</head>
<body>
  <h2>Заказ {{id}}</h2>
  <div class="meta">Клиент: {{client}}</div>
  <div class="meta">Статус: {{status}}</div>
  <div class="meta">Типы: {{types}}</div>
  <div class="meta">Начат: {{startDate}} | План завершения: {{endDate}}</div>
  <hr />
  <h3>Работы</h3>
  {{itemsHtml}}
  <h3>Платежи</h3>
  {{paymentsHtml}}
  <hr />
  <div>Сумма: <b>{{amount}}</b> | Оплачено: <b>{{paid}}</b> | Прибыль: <b>{{profit}}</b></div>
  <div class="muted">Сформировано системой CRM</div>
</body>
</html>`;

export default function Orders() {
  const { type } = useParams(); // parts | detailing | bodywork (по меню)
  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : initialOrders;
  });
  const [editOpen, setEditOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('Не удалось сохранить заказы в localStorage', e);
    }
  }, [orders]);
  const [history, setHistory] = useState([]);
  const [pendingHistory, setPendingHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [statusLogs, setStatusLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [lastStatus, setLastStatus] = useState('');

  // Рефы из API: статусы, типы, схемы полей (best-effort)
  const [statusesGroups, setStatusesGroups] = useState([]);
  const statuses = useMemo(() => flattenStatuses(statusesGroups), [statusesGroups]);
  const allowedStatusNames = useMemo(() => {
    const arr = (statuses || []).map((s) => s.name).filter(Boolean);
    return arr.length ? arr : ORDER_STATUSES;
  }, [statuses]);
  const [orderTypeItems, setOrderTypeItems] = useState([]);
  const [fieldSchemas, setFieldSchemas] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadRefs = async () => {
      try {
        const [stRes, typesRes] = await Promise.all([
          getStatuses().then(r => Array.isArray(r?.data) ? r.data : []),
          orderTypesService.list().then(r => Array.isArray(r?.items) ? r.items : []),
        ]);
        if (mounted) {
          setStatusesGroups(stRes);
          setOrderTypeItems(typesRes);
        }
      } catch (e) {
        // фолбэк — используем локальные настройки ниже
      }
      try {
        const r = await http.get('/field-schemas');
        const list = Array.isArray(r?.data?.items) ? r.data.items : (Array.isArray(r?.data) ? r.data : []);
        if (mounted) setFieldSchemas(list || []);
      } catch (e) {
        if (mounted) setFieldSchemas([]);
      }
    };
    loadRefs();
    return () => { mounted = false; };
  }, []);
  const [orderFields, setOrderFields] = useState([]);

  const typeMap = {
    parts: 'Детали',
    detailing: 'Детейлинг',
    bodywork: 'Кузовной ремонт',
  };

  const location = useLocation();
  const navigate = useNavigate();

  const filteredOrders = useMemo(() => {
    const filterType = typeMap[type];
    let res = orders;
    if (filterType) res = res.filter((o) => (o.types || []).includes(filterType));
    const sp = new URLSearchParams(location.search);
    const clientQ = (sp.get('client') || '').trim().toLowerCase();
    if (clientQ) res = res.filter((o) => (o.client || '').toLowerCase().includes(clientQ));
    return res;
  }, [orders, type, location.search]);

  const openEditor = (row) => {
    setCurrentOrder({
      ...row,
      items: row.items || [],
      payments: row.payments || [],
      tasks: row.tasks || [],
    });
    // начальная история для демонстрации
    setHistory([
      { text: `Добавлен платёж на ${formatCurrency(row.paid || 0)}`, ts: new Date() },
      { text: `Изменён статус на "${row.status}"`, ts: new Date() },
    ]);
    setLastStatus(row.status || '');
    loadStatusLogs(row.id);
    setEditOpen(true);
  };

  const handleRowDoubleClick = (params) => openEditor(params.row);
  const handleRowClick = (params) => openEditor(params.row);

  const handleEditClick = (order) => {
    openEditor(order);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setCurrentOrder((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSave = () => {
    setOrders((prev) => {
      const updated = {
        ...currentOrder,
        amount: Number(currentOrder.amount),
        paid: Number(currentOrder.paid),
        profit: Number(currentOrder.profit),
      };
      const exists = prev.some((o) => o.id === currentOrder.id);
      return exists ? prev.map((o) => (o.id === currentOrder.id ? updated : o)) : [updated, ...prev];
    });
    setHistory((prev) => ([{ text: 'Сохранены изменения заказа', ts: new Date() }, ...pendingHistory, ...prev]));
    setPendingHistory([]);
    setEditOpen(false);
    setCurrentOrder(null);
  };

  const addComment = () => {
    if (!comment.trim()) return;
    setHistory((prev) => ([{ text: comment.trim(), ts: new Date() }, ...prev]));
    setComment('');
  };

  // Helpers: items/payments/tasks updates
  const queueHistory = (text) => setPendingHistory((prev) => ([{ text, ts: new Date() }, ...prev]));

  // Helpers for items/payments/tasks and totals
  const computeOrderTotals = (order) => {
    const items = order.items || [];
    const payments = order.payments || [];
    const itemsTotal = items.reduce((sum, it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      const discount = Number(it.discount || 0);
      return sum + qty * price - discount;
    }, 0);
    const paidTotal = payments.reduce((sum, p) => {
      const amt = Number(p.amount || 0);
      const art = String(p.article || '').toLowerCase();
      if (art === 'возврат предоплаты') return sum - amt;
      return sum + amt;
    }, 0);
    const expensesTotal = payments.reduce((sum, p) => {
      const art = String(p.article || '').toLowerCase();
      if (art === 'служебный расход') return sum + Number(p.amount || 0);
      return sum;
    }, 0);
    const profit = itemsTotal - expensesTotal;
    return { amount: itemsTotal, paid: paidTotal, profit };
  };

  const addItem = () => {
    setCurrentOrder((prev) => {
      const items = [...(prev.items || []), { name: '', performer: '', qty: 1, warrantyDays: 0, price: 0, discount: 0 }];
      const totals = computeOrderTotals({ ...prev, items });
      queueHistory('Добавлен элемент работ');
      return { ...prev, items, ...totals };
    });
  };

  const updateItem = (idx, key, value) => {
    setCurrentOrder((prev) => {
      const items = (prev.items || []).slice();
      items[idx] = { ...items[idx], [key]: value };
      const totals = computeOrderTotals({ ...prev, items });
      queueHistory('Обновлены работы/товары');
      return { ...prev, items, ...totals };
    });
  };

  const removeItem = (idx) => {
    setCurrentOrder((prev) => {
      const items = (prev.items || []).slice();
      items.splice(idx, 1);
      const totals = computeOrderTotals({ ...prev, items });
      queueHistory('Удалён элемент работ');
      return { ...prev, items, ...totals };
    });
  };

  const selectServiceForItem = (idx, name) => {
    const svc = SERVICES.find((s) => s.name === name);
    setCurrentOrder((prev) => {
      const items = (prev.items || []).slice();
      const it = items[idx] || {};
      const qty = Number(it.qty || 1);
      const price = Number(svc?.price || 0);
      items[idx] = { ...it, name, price, qty };
      const totals = computeOrderTotals({ ...prev, items });
      queueHistory(`Выбрана услуга: ${name}`);
      return { ...prev, items, ...totals };
    });
  };

  const selectPerformerForItem = (idx, performer) => {
    setCurrentOrder((prev) => {
      const items = (prev.items || []).slice();
      const it = items[idx] || {};
      items[idx] = { ...it, performer };
      queueHistory('Назначен исполнитель');
      return { ...prev, items };
    });
  };

  const addPayment = (article) => {
    setCurrentOrder((prev) => {
      const payments = [...(prev.payments || []), { article, method: '', receipt: 'Нет', employee: '', date: '', amount: 0 }];
      const totals = computeOrderTotals({ ...prev, payments });
      queueHistory(`Добавлен платёж: ${article}`);
      return { ...prev, payments, ...totals };
    });
  };

  const updatePayment = (idx, keyOrAmount, maybeValue) => {
    const key = typeof keyOrAmount === 'string' ? keyOrAmount : 'amount';
    const value = typeof keyOrAmount === 'string' ? maybeValue : keyOrAmount;
    setCurrentOrder((prev) => {
      const payments = (prev.payments || []).slice();
      payments[idx] = { ...payments[idx], [key]: value };
      const totals = computeOrderTotals({ ...prev, payments });
      queueHistory('Обновлены платежи');
      return { ...prev, payments, ...totals };
    });
  };

  const removePayment = (idx) => {
    setCurrentOrder((prev) => {
      const payments = (prev.payments || []).slice();
      payments.splice(idx, 1);
      const totals = computeOrderTotals({ ...prev, payments });
      queueHistory('Удалён платёж');
      return { ...prev, payments, ...totals };
    });
  };

  const addTask = () => {
    setCurrentOrder((prev) => {
      const tasks = [...(prev.tasks || []), { title: '', assignee: '', done: false }];
      queueHistory('Добавлена задача');
      return { ...prev, tasks };
    });
  };

  const updateTask = (idx, key, value) => {
    setCurrentOrder((prev) => {
      const tasks = (prev.tasks || []).slice();
      tasks[idx] = { ...tasks[idx], [key]: value };
      queueHistory('Обновлены задачи');
      return { ...prev, tasks };
    });
  };

  const printCurrentOrder = () => {
    if (!currentOrder) return;
    const itemsRows = (currentOrder.items || []).map((it) => {
      return `<tr>
        <td>${it.name || '-'}</td>
        <td>${it.performer || '-'}</td>
        <td class="right">${Number(it.qty || 0).toLocaleString('ru-RU')}</td>
        <td class="right">${Number(it.warrantyDays || 0).toLocaleString('ru-RU')}</td>
        <td class="right">${Number(it.price || 0).toLocaleString('ru-RU')}</td>
        <td class="right">${Number(it.discount || 0).toLocaleString('ru-RU')}</td>
        <td class="right">${Number(it.qty * it.price - (it.discount || 0)).toLocaleString('ru-RU')}</td>
      </tr>`;
    }).join('');
    const itemsHtml = `<table><thead><tr>
      <th>Название</th><th>Исполнитель</th><th>Кол-во</th><th>Гарантия</th><th>Цена</th><th>Скидка</th><th>Итого</th>
    </tr></thead><tbody>${itemsRows}</tbody></table>`;

    const paymentsRows = (currentOrder.payments || []).map((p) => {
      return `<tr>
        <td>${p.article || '-'}</td>
        <td>${p.method || '-'}</td>
        <td>${p.receipt || '-'}</td>
        <td>${p.employee || '-'}</td>
        <td>${p.date || '-'}</td>
        <td class="right">${Number(p.amount || 0).toLocaleString('ru-RU')}</td>
      </tr>`;
    }).join('');
    const paymentsHtml = `<table><thead><tr>
      <th>Статья</th><th>Метод</th><th>Чек</th><th>Сотрудник</th><th>Дата</th><th>Сумма</th>
    </tr></thead><tbody>${paymentsRows}</tbody></table>`;

    const tpl = getDocumentTemplate('order', defaultOrderTemplate);
    const ctx = {
      id: currentOrder.id,
      client: currentOrder.client || '-',
      status: currentOrder.status || '-',
      types: (currentOrder.types || []).join(', '),
      startDate: new Date(currentOrder.startDate).toLocaleString('ru-RU'),
      endDate: new Date(currentOrder.endDateForecast).toLocaleString('ru-RU'),
      itemsHtml,
      paymentsHtml,
      amount: Number(currentOrder.amount || 0).toLocaleString('ru-RU'),
      paid: Number(currentOrder.paid || 0).toLocaleString('ru-RU'),
      profit: Number(currentOrder.profit || 0).toLocaleString('ru-RU'),
    };
    const html = renderTemplate(tpl, ctx);
    const w = window.open('', 'PRINT', 'width=900,height=650');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      w.close();
    }
  };
  const loadStatusLogs = async (orderId) => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const data = await http.get(`/orders/${orderId}/status-logs`).then(r => r.data);
      setStatusLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setLogsError(e?.response?.data?.error || e.message || 'Ошибка загрузки истории');
    } finally {
      setLogsLoading(false);
    }
  };

  const submitStatusChange = async () => {
    if (!currentOrder) return;
    try {
      await http.patch(`/orders/${currentOrder.id}/status`, { code: currentOrder.status, prevStatus: lastStatus });
      await loadStatusLogs(currentOrder.id);
    } catch (e) {
      console.warn('Не удалось сменить статус', e);
    }
  };

  const handleStatusChange = (status) => {
    setCurrentOrder((prev) => {
      setLastStatus(prev?.status || '');
      return { ...prev, status };
    });
    queueHistory(`Изменён статус на "${status}"`);
  };

  const handleTypesChange = (types) => {
    setCurrentOrder((prev) => ({ ...prev, types }));
    queueHistory(`Изменены типы: ${(types || []).join(', ')}`);
  };

  const handleTypeChange = (orderTypeId) => {
    const t = orderTypeItems.find((it) => String(it._id) === String(orderTypeId));
    const typeName = t ? (t.name || t.code) : '';
    let nextStatus = currentOrder?.status || '';
    if (t && t.startStatusId) {
      const sid = typeof t.startStatusId === 'object' ? t.startStatusId?._id : t.startStatusId;
      const st = statuses.find((s) => String(s._id) === String(sid));
      if (st && st.name) nextStatus = st.name;
    }
    setCurrentOrder((prev) => ({
      ...prev,
      orderTypeId: orderTypeId || '',
      types: typeName ? [typeName] : [],
      status: nextStatus,
    }));
    queueHistory(`Выбран тип заказа: ${typeName || '—'}`);
    if (t && t.startStatusId) {
      queueHistory(`Начальный статус установлен: "${nextStatus}"`);
    }
  };

  // Добавление нового заказа
  const createNewOrder = () => {
    const nextNumericId = Math.max(
      0,
      ...orders.map((o) => {
        const n = parseInt(String(o.id).replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
      })
    ) + 1;
    const newId = `ORD-${nextNumericId}`;
    const now = new Date();
    const defaultTypes = typeMap[type] ? [typeMap[type]] : [];

    // попробовать выбрать тип из загруженных по названию из маршрута
    let orderTypeId = '';
    let initialStatus = 'Новый';
    if (orderTypeItems.length) {
      const preferredName = typeMap[type];
      const t = orderTypeItems.find((it) => (it.name || it.code) === preferredName) || orderTypeItems[0];
      if (t) {
        orderTypeId = t._id;
        const sid = typeof t.startStatusId === 'object' ? t.startStatusId?._id : t.startStatusId;
        const st = statuses.find((s) => String(s._id) === String(sid));
        if (st && st.name) initialStatus = st.name;
      }
    }

    const derivedTypes = (() => {
      if (!orderTypeItems.length) return defaultTypes;
      if (orderTypeId) {
        const found = orderTypeItems.find(it => String(it._id) === String(orderTypeId));
        return [found?.name || found?.code || ''];
      }
      return [];
    })();

    const newOrder = {
      id: newId,
      client: '',
      types: derivedTypes,
      orderTypeId: orderTypeId || undefined,
      status: orderTypeItems.length ? initialStatus : 'Новый',
      startDate: now,
      endDateForecast: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      amount: 0,
      paid: 0,
      profit: 0,
      items: [],
      payments: [],
      tasks: [],
    };
    openEditor(newOrder);
  };
  const handleOrderFieldChange = (name, value) => {
    setCurrentOrder((prev) => ({ ...prev, [name]: value }));
  };

  const columns = [
    { field: 'id', headerName: 'ID', width: 140 },
    { field: 'client', headerName: 'Клиент', width: 200 },
    {
      field: 'types',
      headerName: 'Тип',
      width: 220,
      valueGetter: (params) => (params.row.types || []).join(', '),
    },
    { field: 'status', headerName: 'Статус', width: 140 },
    {
      field: 'startDate',
      headerName: 'Дата начала',
      width: 170,
      valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU'),
    },
    {
      field: 'endDateForecast',
      headerName: 'План завершения',
      width: 170,
      valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU'),
    },
    { field: 'amount', headerName: 'Сумма', width: 140 },
    { field: 'paid', headerName: 'Оплачено', width: 140 },
    { field: 'profit', headerName: 'Прибыль', width: 140 },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 280,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={() => handleEditClick(params.row)}>Редактировать</Button>
          <Button variant="contained" size="small" onClick={() => navigate(`/payments?client=${encodeURIComponent(params.row.client)}&order=${encodeURIComponent(params.row.id)}`)}>Платежи</Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        {typeMap[type] ? `Заказы: ${typeMap[type]}` : 'Все заказы'}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" color="primary" onClick={createNewOrder}>Добавить заказ</Button>
      </Box>

      <Paper sx={{ height: 500, width: '100%' }}>
        <DataGrid
          rows={filteredOrders}
          columns={columns}
          pageSize={8}
          rowsPerPageOptions={[8, 16, 32]}
          disableSelectionOnClick
          onRowDoubleClick={handleRowDoubleClick}
          onRowClick={handleRowClick}
          getRowId={(row) => row.id}
        />
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullScreen>
        {currentOrder && (
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mr: 2 }}>{`Заказ ${currentOrder.id}`}</Typography>
              <Chip color="primary" label={formatCurrency(currentOrder.amount || 0)} sx={{ mr: 2 }} />
              <FormControl size="small" sx={{ minWidth: 160, mr: 1 }}>
                <Select value={currentOrder.status || ''} onChange={(e)=>handleStatusChange(e.target.value)} disabled={!!orderTypeItems.length && !currentOrder.orderTypeId}>
                  {allowedStatusNames.map((s)=> (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                {orderTypeItems.length ? (
                  <Select value={currentOrder.orderTypeId || ''} onChange={(e)=>handleTypeChange(e.target.value)} displayEmpty>
                    <MenuItem value=""><em>Тип не выбран</em></MenuItem>
                    {orderTypeItems.map((t)=> (
                      <MenuItem key={t._id} value={t._id}>{t.name || t.code}</MenuItem>
                    ))}
                  </Select>
                ) : (
                  <Select multiple value={currentOrder.types || []} onChange={(e)=>handleTypesChange(e.target.value)} renderValue={(selected)=>(selected || []).join(', ')}>
                    {ALL_TYPES.map((t)=> (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                )}
              </FormControl>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton aria-label="close" onClick={() => setEditOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Grid container sx={{ height: '100%' }}>
                {/* Left: History */}
                <Grid item xs={12} md={4} lg={3} sx={{ borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 3 }}>
                    <Typography variant="h6">История</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <TextField size="small" fullWidth placeholder="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} />
                      <Button variant="contained" onClick={addComment}>Добавить</Button>
                    </Stack>
                  </Box>
                  <Divider />
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    <List dense>
                      {pendingHistory.map((h) => (
                        <ListItem key={`p-${h.ts}`}>
                          <ListItemText primary={h.text} secondary={new Date(h.ts).toLocaleString('ru-RU')} />
                        </ListItem>
                      ))}
                      {history.map((h) => (
                        <ListItem key={h.ts}>
                          <ListItemText primary={h.text} secondary={new Date(h.ts).toLocaleString('ru-RU')} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Grid>

                {/* Right: Editor */}
                <Grid item xs={12} md={8} lg={9} sx={{ p: 3, overflow: 'auto' }}>
                  <Typography variant="h6" gutterBottom>Позиции</Typography>
                  <Paper sx={{ mb: 3, p: 2 }}>
                    <Stack spacing={2}>
                      {(currentOrder.items || []).map((it, idx) => (
                        <Grid container spacing={2} key={idx}>
                          <Grid item xs={12} md={4}>
                            <TextField label="Наименование" fullWidth size="small" value={it.name} onChange={(e)=>updateItem(idx, 'name', e.target.value)} />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField label="Кол-во" type="number" fullWidth size="small" value={it.qty} onChange={(e)=>updateItem(idx, 'qty', Number(e.target.value))} />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField label="Цена" type="number" fullWidth size="small" value={it.price} onChange={(e)=>updateItem(idx, 'price', Number(e.target.value))} />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField label="Сумма" type="number" fullWidth size="small" value={it.total} disabled />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <Select fullWidth size="small" displayEmpty value={it.assignee || ''} onChange={(e)=>updateItem(idx, 'assignee', e.target.value)}>
                              <MenuItem value=""><em>Исполнитель</em></MenuItem>
                              {PERFORMERS.map((p)=> (
                                <MenuItem key={p} value={p}>{p}</MenuItem>
                              ))}
                            </Select>
                          </Grid>
                          <Grid item xs={12}>
                            <Stack direction="row" spacing={1}>
                              <Button variant="outlined" size="small" onClick={()=>selectServiceForItem(idx, 'Полировка кузова')}>Полировка кузова</Button>
                              <Button variant="outlined" size="small" onClick={()=>selectServiceForItem(idx, 'Замена стекла')}>Замена стекла</Button>
                              <Button variant="outlined" size="small" onClick={()=>removeItem(idx)}>Удалить</Button>
                            </Stack>
                          </Grid>
                        </Grid>
                      ))}
                      <Box>
                        <Button variant="outlined" size="small" onClick={addItem}>Добавить позицию</Button>
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Payments */}
                  <Typography variant="h6" gutterBottom>Платежи</Typography>
                  <Paper sx={{ mb: 3, p: 2 }}>
                    <Stack spacing={1}>
                      {(currentOrder.payments || []).map((p, idx) => (
                        <Stack key={idx} direction="row" spacing={2} alignItems="center">
                          <Chip label={new Date(p.date).toLocaleString('ru-RU')} />
                          <TextField label="Сумма" type="number" size="small" value={p.amount} onChange={(e)=>updatePayment(idx, Number(e.target.value))} />
                          <Button variant="outlined" size="small" onClick={()=>removePayment(idx)}>Удалить</Button>
                        </Stack>
                      ))}
                      <Box>
                        <Button variant="outlined" size="small" onClick={addPayment}>Добавить платёж</Button>
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Timeline */}
                  <Typography variant="h6" gutterBottom>Сроки</Typography>
                  <Paper sx={{ mb: 3, p: 2 }}>
                    <OrderTimeline
                      startDate={currentOrder.startDate}
                      endDateForecast={currentOrder.endDateForecast}
                      onChange={(start, end) => setCurrentOrder((prev) => ({ ...prev, startDate: start, endDateForecast: end }))}
                    />
                  </Paper>

                  {/* Tasks */}
                  <Typography variant="h6" gutterBottom>Задачи</Typography>
                  <Paper sx={{ mb: 3, p: 2 }}>
                    <Stack spacing={1}>
                      {(currentOrder.tasks || []).map((t, idx) => (
                        <Stack key={idx} direction="row" spacing={2} alignItems="center">
                          <Chip variant={t.done ? 'filled' : 'outlined'} color={t.done ? 'success' : 'default'} label={t.done ? 'Готово' : 'Задача'} />
                          <TextField fullWidth size="small" value={t.title} onChange={(e)=>updateTask(idx,'title',e.target.value)} />
                          <Select size="small" value={t.assignee || ''} onChange={(e)=>updateTask(idx,'assignee',e.target.value)} sx={{ minWidth: 140 }}>
                            <MenuItem value="">-</MenuItem>
                            <MenuItem value="vblazhenov">vblazhenov</MenuItem>
                            <MenuItem value="manager1">manager1</MenuItem>
                          </Select>
                          <Checkbox checked={!!t.done} onChange={(e)=>updateTask(idx,'done',e.target.checked)} />
                        </Stack>
                      ))}
                      <Box>
                        <Button variant="outlined" size="small" onClick={()=>addTask()}>Добавить задачу</Button>
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Дополнительно */}
                  <Typography variant="h6" gutterBottom>Дополнительно</Typography>
                  <Paper sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}><TextField label="Причина обращения" fullWidth size="small" value={currentOrder.reason || ''} onChange={handleEditChange} name="reason" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Вид ТС" fullWidth size="small" value={currentOrder.vehicleType || ''} onChange={handleEditChange} name="vehicleType" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Марка" fullWidth size="small" value={currentOrder.brand || ''} onChange={handleEditChange} name="brand" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Модель" fullWidth size="small" value={currentOrder.model || ''} onChange={handleEditChange} name="model" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="VIN" fullWidth size="small" value={currentOrder.vin || ''} onChange={handleEditChange} name="vin" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Менеджер" fullWidth size="small" value={currentOrder.manager || ''} onChange={handleEditChange} name="manager" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Исполнитель" fullWidth size="small" value={currentOrder.assignee || ''} onChange={handleEditChange} name="assignee" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Срок" fullWidth size="small" value={currentOrder.due || ''} onChange={handleEditChange} name="due" /></Grid>
                    </Grid>

                    {orderFields.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Grid container spacing={2}>
                          {orderFields.map((f) => (
                            <Grid item xs={12} md={6} key={f.name}>
                              {f.type === 'checkbox' ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Checkbox checked={!!currentOrder[f.name]} onChange={(e)=>handleOrderFieldChange(f.name, e.target.checked)} />
                                  <Typography>{f.label}</Typography>
                                </Stack>
                              ) : (
                                <TextField label={f.label} fullWidth size="small" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={currentOrder[f.name] || ''} onChange={(e)=>handleOrderFieldChange(f.name, e.target.value)} />
                              )}
                            </Grid>
                          ))}
                        </Grid>
                      </>
                    )}
                  </Paper>

                  <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    <Button onClick={() => setEditOpen(false)}>Закрыть</Button>
                    <Button variant="contained" onClick={handleEditSave}>Сохранить</Button>
                    <Button variant="outlined" onClick={printCurrentOrder}>Печать</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );

}

function flattenStatuses(groups) {
  const arr = [];
  (groups || []).forEach((g) => (g.items || []).forEach((s) => arr.push(s)));
  return arr;
}