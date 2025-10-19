import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Select, InputLabel, FormControl, Divider, List, ListItem, ListItemText, Chip, Stack, IconButton, Checkbox } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid } from '@mui/x-data-grid';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

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

  // Настройки: статусы, типы, методы оплаты, статьи платежей, доп. поля
  const orderStatuses = useMemo(() => {
    try {
      const raw = localStorage.getItem('settings_order_statuses');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return ORDER_STATUSES;
  }, []);

  const orderTypes = useMemo(() => {
    try {
      const raw = localStorage.getItem('settings_order_types');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return ALL_TYPES;
  }, []);

  const availableMethods = useMemo(() => {
    try {
      const raw = localStorage.getItem('payment_methods');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return ['Наличные','Карта','Банковский перевод'];
  }, []);
  const availableCategories = useMemo(() => {
    try {
      const raw = localStorage.getItem('payment_categories');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr)) return arr;
    } catch {}
    return [];
  }, []);

  const orderFields = useMemo(() => {
    try {
      const raw = localStorage.getItem('settings_order_fields');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr)) return arr;
    } catch {}
    return [];
  }, []);

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
  const logHistory = (text) => setHistory((prev) => ([{ text, ts: new Date() }, ...prev]));
  const queueHistory = (text) => setPendingHistory((prev) => ([{ text, ts: new Date() }, ...prev]));

  const calcAmount = (items) => (items || []).reduce((sum, it) => (
    sum + Number(it.qty || 0) * Number(it.price || 0) - Number(it.discount || 0)
  ), 0);

  // Печать текущего заказа по шаблону (расположено до return)
  const printCurrentOrder = () => {
    if (!currentOrder) return;
    const items = currentOrder.items || [];
    const payments = currentOrder.payments || [];

    const itemsRows = items
      .map((it) => {
        const total = Math.max(Number(it.qty || 0) * Number(it.price || 0) - Number(it.discount || 0), 0);
        return `
          <tr>
            <td>${it.name || '-'}</td>
            <td>${it.performer || '-'}</td>
            <td class="right">${Number(it.qty || 0)}</td>
            <td class="right">${Number(it.warrantyDays || 0)}</td>
            <td class="right">${formatCurrency(it.price || 0)}</td>
            <td class="right">${formatCurrency(it.discount || 0)}</td>
            <td class="right">${formatCurrency(total)}</td>
          </tr>`;
      })
      .join('');

    const itemsHtml = items.length
      ? `<table>
           <thead>
             <tr>
               <th>Название</th>
               <th>Исполнитель</th>
               <th class="right">Кол-во</th>
               <th class="right">Гарантия, дн.</th>
               <th class="right">Цена, ₽</th>
               <th class="right">Скидка, ₽</th>
               <th class="right">Итого, ₽</th>
             </tr>
           </thead>
           <tbody>${itemsRows}</tbody>
         </table>`
      : '<div class="muted">Нет работ</div>';

    const paymentsRows = payments
      .map((p) => {
        return `
          <tr>
            <td>${p.article || '-'}</td>
            <td>${p.method || '-'}</td>
            <td>${p.receipt || '-'}</td>
            <td>${p.employee || '-'}</td>
            <td>${p.date ? new Date(p.date).toLocaleString('ru-RU') : '-'}</td>
            <td class="right">${formatCurrency(p.amount || 0)}</td>
          </tr>`;
      })
      .join('');

    const paymentsHtml = payments.length
      ? `<table>
           <thead>
             <tr>
               <th>Статья</th>
               <th>Метод</th>
               <th>Чек</th>
               <th>Сотрудник</th>
               <th>Дата</th>
               <th class="right">Сумма, ₽</th>
             </tr>
           </thead>
           <tbody>${paymentsRows}</tbody>
         </table>`
      : '<div class="muted">Нет платежей</div>';

    const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const ctx = {
      id: currentOrder.id,
      client: currentOrder.client || '-',
      status: currentOrder.status || '-',
      types: (currentOrder.types || []).join(', '),
      startDate: currentOrder.startDate ? new Date(currentOrder.startDate).toLocaleString('ru-RU') : '-',
      endDate: currentOrder.endDateForecast ? new Date(currentOrder.endDateForecast).toLocaleString('ru-RU') : '-',
      itemsHtml,
      paymentsHtml,
      amount: formatCurrency(currentOrder.amount || 0),
      paid: formatCurrency(paidTotal),
      profit: formatCurrency(currentOrder.profit || 0),
    };

    const tpl = getDocumentTemplate('order', defaultOrderTemplate);
    const html = renderTemplate(tpl, ctx);

    const w = window.open('', 'PRINT', 'height=700,width=900');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const updateItem = (idx, key, value) => {
    setCurrentOrder((prev) => {
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], [key]: value };
      const amount = calcAmount(items);
      return { ...prev, items, amount };
    });
    if (key === 'name') queueHistory(`Изменена услуга: "${value}"`);
    if (key === 'performer') queueHistory(`Назначен исполнитель: ${value || '-'}`);
    if (key === 'price') queueHistory(`Изменена цена услуги: ${formatCurrency(value)}`);
    if (key === 'discount') queueHistory(`Изменена скидка: ${formatCurrency(value)}`);
  };

  const updatePayment = (idx, key, value) => {
    setCurrentOrder((prev) => {
      const payments = [...(prev.payments || [])];
      payments[idx] = { ...payments[idx], [key]: value };
      return { ...prev, payments };
    });
    queueHistory(`Обновлен платёж: поле ${key} -> ${value}`);
  };

  const addPayment = (article) => {
    setCurrentOrder((prev) => ({
      ...prev,
      payments: [ ...(prev.payments || []), { article, method: 'Наличные', receipt: 'Нет', employee: 'vblazhenov', date: new Date().toLocaleString('ru-RU'), amount: 0 } ]
    }));
    queueHistory(`Добавлен платёж: ${article}`);
  };

  const updateTask = (idx, key, value) => {
    setCurrentOrder((prev) => {
      const tasks = [...(prev.tasks || [])];
      tasks[idx] = { ...tasks[idx], [key]: value };
      return { ...prev, tasks };
    });
    if (key === 'done') queueHistory(`Статус задачи изменён: ${value ? 'Готово' : 'В работе'}`);
    if (key === 'assignee') queueHistory(`Назначен исполнитель задачи: ${value || '-'}`);
    if (key === 'title') queueHistory('Изменено название задачи');
  };

  const addTask = () => {
    setCurrentOrder((prev) => ({
      ...prev,
      tasks: [ ...(prev.tasks || []), { title: 'Новая задача', assignee: '', done: false } ]
    }));
    queueHistory('Добавлена задача');
  };

  const addItem = () => {
    setCurrentOrder((prev) => {
      const items = [ ...(prev.items || []), { name: '', performer: '', qty: 1, warrantyDays: 0, price: 0, discount: 0 } ];
      const amount = calcAmount(items);
      return { ...prev, items, amount };
    });
    queueHistory('Добавлена услуга/товар');
  };

  const selectServiceForItem = (idx, serviceName) => {
    const service = SERVICES.find((s) => s.name === serviceName);
    const price = service ? Number(service.price) : 0;
    setCurrentOrder((prev) => {
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], name: serviceName, price };
      const amount = calcAmount(items);
      return { ...prev, items, amount };
    });
    queueHistory(`Выбрана услуга: "${serviceName}" (цена ${formatCurrency(price)})`);
  };

  const selectPerformerForItem = (idx, performer) => {
    updateItem(idx, 'performer', performer);
  };

  const handleStatusChange = (status) => {
    setCurrentOrder((prev) => ({ ...prev, status }));
    queueHistory(`Изменён статус на "${status}"`);
  };

  const handleTypesChange = (types) => {
    setCurrentOrder((prev) => ({ ...prev, types }));
    queueHistory(`Изменены типы: ${(types || []).join(', ')}`);
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
    const newOrder = {
      id: newId,
      client: '',
      types: defaultTypes,
      status: 'Новый',
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
      headerName: 'Прогноз завершения',
      width: 190,
      valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU'),
    },
    {
      field: 'amount',
      headerName: 'Сумма',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'paid',
      headerName: 'Оплачено',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'debt',
      headerName: 'Задолженность',
      width: 160,
      valueGetter: (params) => Number(params.row.amount || 0) - Number(params.row.paid || 0),
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'profit',
      headerName: 'Прибыль',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 240,
      sortable: false,
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
                <Select value={currentOrder.status || 'Новый'} onChange={(e)=>handleStatusChange(e.target.value)}>
                  {orderStatuses.map((s)=> (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select multiple value={currentOrder.types || []} onChange={(e)=>handleTypesChange(e.target.value)} renderValue={(selected)=>(selected || []).join(', ')}>
                  {orderTypes.map((t)=> (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
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
                      {history.map((h, idx) => (
                        <ListItem key={idx} alignItems="flex-start">
                          <ListItemText primary={h.text} secondary={new Date(h.ts).toLocaleString('ru-RU')} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Grid>

                {/* Right: Order info & editing */}
                <Grid item xs={12} md={8} lg={9} sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
                  {/* Товары и услуги */}
                  <Typography variant="h6" gutterBottom>Товары и услуги</Typography>
                  <Paper sx={{ mb: 3 }}>
                    <Box sx={{ p: 2 }}>
                      <Button variant="outlined" size="small" onClick={addItem}>Добавить</Button>
                    </Box>
                    <Divider />
                    <Box sx={{ p: 2 }}>
                      <Grid container spacing={1}>
                        <Grid item xs={3}><Typography variant="body2">Название</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2">Исполнитель</Typography></Grid>
                        <Grid item xs={1}><Typography variant="body2">Кол-во</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2">Гарантия, дн.</Typography></Grid>
                        <Grid item xs={1.5}><Typography variant="body2">Цена, ₽</Typography></Grid>
                        <Grid item xs={1.5}><Typography variant="body2">Скидка, ₽</Typography></Grid>
                        <Grid item xs={1.5}><Typography variant="body2">Итого, ₽</Typography></Grid>
                      </Grid>
                      <Divider sx={{ my: 1 }} />
                      {(currentOrder.items || []).map((it, idx) => (
                        <Grid key={idx} container spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Grid item xs={3}>
                            <Select fullWidth size="small" value={it.name || ''} onChange={(e)=>selectServiceForItem(idx, e.target.value)} displayEmpty>
                              <MenuItem value=""><em>-</em></MenuItem>
                              {SERVICES.map((s) => (
                                <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>
                              ))}
                            </Select>
                          </Grid>
                          <Grid item xs={2}>
                            <Select fullWidth size="small" value={it.performer || ''} onChange={(e)=>selectPerformerForItem(idx, e.target.value)} displayEmpty>
                              <MenuItem value=""><em>-</em></MenuItem>
                              {PERFORMERS.map((p) => (
                                <MenuItem key={p} value={p}>{p}</MenuItem>
                              ))}
                            </Select>
                          </Grid>
                          <Grid item xs={1}><TextField type="number" fullWidth size="small" value={it.qty} onChange={(e)=>updateItem(idx,'qty',Number(e.target.value))} /></Grid>
                          <Grid item xs={2}><TextField type="number" fullWidth size="small" value={it.warrantyDays} onChange={(e)=>updateItem(idx,'warrantyDays',Number(e.target.value))} /></Grid>
                          <Grid item xs={1.5}><TextField type="number" fullWidth size="small" value={it.price} onChange={(e)=>updateItem(idx,'price',Number(e.target.value))} /></Grid>
                          <Grid item xs={1.5}><TextField type="number" fullWidth size="small" value={it.discount} onChange={(e)=>updateItem(idx,'discount',Number(e.target.value))} /></Grid>
                          <Grid item xs={1.5}><Typography>{formatCurrency(it.qty*it.price - (it.discount||0))}</Typography></Grid>
                        </Grid>
                      ))}
                    </Box>
                  </Paper>

                  {/* Платежи */}
                  <Typography variant="h6" gutterBottom>Платежи</Typography>
                  <Paper sx={{ mb: 3 }}>
                    <Box sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1}>
                        <Chip label="Предоплата" onClick={() => addPayment('Предоплата')} />
                        <Chip label="Возврат предоплаты" onClick={() => addPayment('Возврат предоплаты')} />
                        <Chip label="Служебный расход" onClick={() => addPayment('Служебный расход')} />
                      </Stack>
                    </Box>
                    <Divider />
                    <Box sx={{ p: 2 }}>
                      <Grid container spacing={1}>
                        <Grid item xs={3}><Typography variant="body2">Статья</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2">Метод</Typography></Grid>
                        <Grid item xs={1.5}><Typography variant="body2">Чек</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2">Сотрудник</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2">Дата</Typography></Grid>
                        <Grid item xs={1.5}><Typography variant="body2">Сумма, ₽</Typography></Grid>
                      </Grid>
                      <Divider sx={{ my: 1 }} />
                      {(currentOrder.payments || []).map((p, idx) => (
                        <Grid key={idx} container spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Grid item xs={3}><Select fullWidth size="small" value={p.article || ''} onChange={(e)=>updatePayment(idx,'article',e.target.value)}>
                            <MenuItem value="">-</MenuItem>
                            {availableCategories.map((c)=>(<MenuItem key={c} value={c}>{c}</MenuItem>))}
                          </Select></Grid>
                          <Grid item xs={2}><Select fullWidth size="small" value={p.method || ''} onChange={(e)=>updatePayment(idx,'method',e.target.value)}>
                            <MenuItem value="">-</MenuItem>
                            {availableMethods.map((m)=>(<MenuItem key={m} value={m}>{m}</MenuItem>))}
                          </Select></Grid>
                          <Grid item xs={1.5}><Select fullWidth size="small" value={p.receipt || 'Нет'} onChange={(e)=>updatePayment(idx,'receipt',e.target.value)}>
                            <MenuItem value="Да">Да</MenuItem>
                            <MenuItem value="Нет">Нет</MenuItem>
                          </Select></Grid>
                          <Grid item xs={2}><TextField fullWidth size="small" value={p.employee} onChange={(e)=>updatePayment(idx,'employee',e.target.value)} /></Grid>
                          <Grid item xs={2}><TextField fullWidth size="small" value={p.date} onChange={(e)=>updatePayment(idx,'date',e.target.value)} /></Grid>
                          <Grid item xs={1.5}><TextField type="number" fullWidth size="small" value={p.amount} onChange={(e)=>updatePayment(idx,'amount',Number(e.target.value))} /></Grid>
                        </Grid>
                      ))}
                    </Box>
                  </Paper>

                  {/* Задачи */}
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