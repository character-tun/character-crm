import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid, IconButton, InputLabel, List, ListItem, ListItemText, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DataGridBase from '../../components/DataGridBase';

const LS = {
  suppliers: 'warehouse_suppliers',
  orders: 'warehouse_supplier_orders',
  products: 'warehouse_products',
  categories: 'warehouse_categories',
};

const currency = (n) => `₽${Number(n || 0).toLocaleString('ru-RU')}`;
const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const calcSubtotal = (items) => (items || []).reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);
const calcGrandTotal = (items, discount = 0, taxPercent = 0) => {
  const subtotal = calcSubtotal(items);
  const safeDiscount = Math.min(Math.max(Number(discount || 0), 0), subtotal);
  const base = subtotal - safeDiscount;
  const tax = Math.max(Number(taxPercent || 0), 0) / 100 * base;
  return Math.round((base + tax) * 100) / 100;
};
const ORDER_STATUSES = ['Новый', 'В процессе', 'Завершён', 'Отменён'];

export default function InventoryOrdersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS.suppliers) || '[]');
      const o = JSON.parse(localStorage.getItem(LS.orders) || '[]');
      const c = JSON.parse(localStorage.getItem(LS.categories) || '[]');
      const p = JSON.parse(localStorage.getItem(LS.products) || '[]');
      setSuppliers(s);
      setOrders(o);
      setCategories(c);
      setProducts(p);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS.orders, JSON.stringify(orders)); } catch {}
  }, [orders]);

  const columns = [
    { field: 'number', headerName: 'Номер', width: 140 },
    { field: 'supplierName', headerName: 'Поставщик', flex: 1, minWidth: 220 },
    { field: 'date', headerName: 'Дата', width: 180, renderCell: (p) => new Date(p.value).toLocaleString('ru-RU') },
    { field: 'itemCount', headerName: 'Позиций', width: 110 },
    { field: 'total', headerName: 'Итого', width: 130, renderCell: (p) => currency(p.value) },
    { field: 'paid', headerName: 'Оплачено', width: 130, renderCell: (p) => currency(p.value) },
    { field: 'remaining', headerName: 'Остаток', width: 130, renderCell: (p) => currency(p.value) },
    { field: 'status', headerName: 'Статус', width: 140 },
    {
      field: 'actions', headerName: 'Действия', width: 160, sortable: false, filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => openEditOrder(params.row)} aria-label="edit"><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => handleDeleteOrder(params.row)} aria-label="delete"><DeleteIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => handlePrintOrder(params.row)} aria-label="print"><PrintIcon fontSize="small" /></IconButton>
        </Stack>
      )
    },
  ];

  const withSupplierName = useMemo(() => {
    const m = Object.fromEntries(suppliers.map((s) => [s.id, s.orgName]));
    return orders
      .filter((o) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const sn = (m[o.supplierId] || '').toLowerCase();
        return (o.number || '').toLowerCase().includes(q) || sn.includes(q);
      })
      .map((o) => {
        const paid = (o.payments || []).reduce((s,p) => s + Number(p.amount||0), 0);
        const remaining = Math.max(Number(o.total||0) - paid, 0);
        return { ...o, supplierName: m[o.supplierId] || '-', itemCount: (o.items || []).length, paid, remaining };
      });
  }, [orders, suppliers, search]);

  const supplierBalances = useMemo(() => {
    const res = new Map();
    orders.forEach(o => {
      const paid = (o.payments || []).reduce((s,p) => s + Number(p.amount||0), 0);
      const total = Number(o.total||0);
      const sb = res.get(o.supplierId) || { totalDue: 0, paid: 0 };
      sb.totalDue += total; sb.paid += paid; res.set(o.supplierId, sb);
    });
    return Array.from(res.entries()).map(([supplierId, v]) => ({ supplierId, totalDue: v.totalDue, paid: v.paid, remaining: Math.max(v.totalDue - v.paid, 0) }));
  }, [orders]);

  // Create order dialog
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderDraft, setOrderDraft] = useState({ supplierId: '', items: [], discount: 0, taxPercent: 0, status: 'Новый', payments: [] });
  const [categoryFilter, setCategoryFilter] = useState(null);

  const descendantIds = useCallback((id) => {
    const res = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const kids = categories.filter((c) => c.parentId === cur);
      kids.forEach((k) => { res.push(k.id); stack.push(k.id); });
    }
    return res;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    if (!categoryFilter) return products;
    const ids = [categoryFilter, ...descendantIds(categoryFilter)];
    return products.filter((p) => ids.includes(p.categoryId));
  }, [products, categoryFilter, descendantIds]);

  const addItemToOrder = (product) => {
    setOrderDraft((prev) => {
      const items = [...(prev.items || [])];
      const existed = items.find((i) => i.productId === product.id);
      if (existed) existed.qty += 1; else items.push({ productId: product.id, name: product.name, qty: 1, price: Number(product.price || 0) });
      return { ...prev, items };
    });
  };

  const updateItem = (idx, key, value) => {
    const v = Number(value);
    setOrderDraft((prev) => {
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], [key]: Math.max(isNaN(v) ? 0 : v, 0) };
      return { ...prev, items };
    });
  };

  const openCreateOrder = () => { setOrderDraft({ supplierId: '', items: [], discount: 0, taxPercent: 0, status: 'Новый', payments: [] }); setCategoryFilter(null); setOrderDialog(true); };
  const saveOrder = () => {
    if (!orderDraft.supplierId || !(orderDraft.items || []).length) return;
    const id = genId('po');
    const number = `PO-${new Date().getFullYear()}-${Math.floor(Math.random()*900+100)}`;
    const total = calcGrandTotal(orderDraft.items, orderDraft.discount, orderDraft.taxPercent);
    const order = {
      id, number,
      supplierId: orderDraft.supplierId,
      date: new Date().toISOString(),
      items: orderDraft.items,
      discount: Number(orderDraft.discount || 0),
      taxPercent: Number(orderDraft.taxPercent || 0),
      total,
      status: orderDraft.status || 'Новый',
      payments: orderDraft.payments || []
    };
    setOrders((prev) => ([order, ...prev]));
    setOrderDialog(false);
  };

  // Edit / actions
  const [editDialog, setEditDialog] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const openEditOrder = (row) => {
    const order = orders.find((o) => o.id === row.id);
    if (!order) return;
    // Deep copy to edit safely
    setCurrentOrder(JSON.parse(JSON.stringify(order)));
    setEditDialog(true);
  };
  const handleDeleteOrder = (row) => {
    if (!window.confirm(`Удалить заказ ${row.number}?`)) return;
    setOrders((prev) => prev.filter((o) => o.id !== row.id));
  };
  const handlePrintOrder = (row) => {
    const o = orders.find((x) => x.id === row.id);
    if (!o) return;
    const supplier = suppliers.find((s) => s.id === o.supplierId);
    const html = `
      <html><head><title>${o.number}</title></head><body>
      <h2>Заказ ${o.number}</h2>
      <div>Поставщик: ${supplier ? supplier.orgName : '-'}</div>
      <div>Дата: ${new Date(o.date).toLocaleString('ru-RU')}</div>
      <div>Статус: ${o.status || ''}</div>
      <hr />
      <table border="1" cellspacing="0" cellpadding="6">
        <thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
        <tbody>
          ${(o.items || []).map(it => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${currency(it.price)}</td><td>${currency(it.qty * it.price)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p>Скидка: ${currency(o.discount || 0)}; Налог: ${o.taxPercent || 0}%</p>
      <h3>Итого: ${currency(o.total)}</h3>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  const exportOrdersCsv = () => {
    const m = Object.fromEntries(suppliers.map(s => [s.id, s.orgName]));
    const header = ['Номер','Дата','Поставщик','Позиций','Сумма','Скидка','Налог%','Итого','Статус','Оплачено','Остаток'];
    const rows = orders.map(o => {
      const subtotal = calcSubtotal(o.items || []);
      const paid = (o.payments || []).reduce((s,p) => s + Number(p.amount||0), 0);
      const remaining = Math.max(Number(o.total||0) - paid, 0);
      return [
        o.number,
        new Date(o.date).toLocaleString('ru-RU'),
        m[o.supplierId] || '-',
        (o.items||[]).length,
        subtotal,
        Number(o.discount||0),
        Number(o.taxPercent||0),
        Number(o.total||0),
        o.status || '',
        paid,
        remaining,
      ];
    });
    const content = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Заказы поставщикам</Typography>
        <Stack direction="row" spacing={2}>
          <TextField size="small" placeholder="Поиск по номеру/поставщику" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportOrdersCsv}>Экспорт CSV</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateOrder}>Создать заказ</Button>
        </Stack>
      </Box>

      <Paper sx={{ height: 520 }}>
        <DataGridBase rows={withSupplierName} columns={columns} getRowId={(r) => r.id} pageSize={10} rowsPerPageOptions={[10, 25]} disableSelectionOnClick />
      </Paper>

      <Paper sx={{ mt: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Сводный баланс по поставщикам</Typography>
        <List>
          {supplierBalances.length === 0 ? (
            <ListItem><ListItemText primary="Нет данных" /></ListItem>
          ) : (
            supplierBalances.map(sb => (
              <ListItem key={sb.supplierId}>
                <ListItemText primary={suppliers.find(s => s.id === sb.supplierId)?.orgName || '-'}
                              secondary={`Оплачено: ${currency(sb.paid)} • Остаток: ${currency(sb.remaining)} • Всего к оплате: ${currency(sb.totalDue)}`} />
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      <Dialog open={orderDialog} onClose={() => setOrderDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Заказ поставщику</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="supplier-select-label">Поставщик</InputLabel>
                <Select labelId="supplier-select-label" label="Поставщик" value={orderDraft.supplierId} onChange={(e) => setOrderDraft((p) => ({ ...p, supplierId: e.target.value }))}>
                  {suppliers.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.orgName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Категории</Typography>
                <List>
                  <ListItem disableGutters>
                    <Button size="small" onClick={() => setCategoryFilter(null)}>Все категории</Button>
                  </ListItem>
                  {(categories.filter((c)=>!c.parentId)).map((c) => (
                    <React.Fragment key={c.id}>
                      <ListItem disableGutters>
                        <Button size="small" onClick={() => setCategoryFilter(c.id)}>{c.name}</Button>
                      </ListItem>
                      {(categories.filter((x)=>x.parentId===c.id)).map((sc) => (
                        <ListItem key={sc.id} sx={{ pl: 3 }} disableGutters>
                          <Button size="small" onClick={() => setCategoryFilter(sc.id)}>{sc.name}</Button>
                        </ListItem>
                      ))}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Товары</Typography>
                <List>
                  {filteredProducts.map((p) => (
                    <ListItem key={p.id} secondaryAction={<Button size="small" variant="outlined" onClick={() => addItemToOrder(p)}>Добавить</Button>}>
                      <ListItemText primary={p.name} secondary={`Цена: ${currency(p.price)} • Себестоимость: ${currency(p.cost)}`} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Позиции заказа</Typography>
                {(orderDraft.items || []).length === 0 ? (
                  <Typography color="text.secondary">Товары не выбраны</Typography>
                ) : (
                  <List>
                    {(orderDraft.items || []).map((it, idx) => (
                      <ListItem key={idx} secondaryAction={<Typography>{currency(Number(it.qty || 0) * Number(it.price || 0))}</Typography>}>
                        <ListItemText primary={it.name} />
                        <TextField label="Кол-во" type="number" size="small" sx={{ width: 90, mr: 1 }} value={it.qty} onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))} />
                        <TextField label="Цена" type="number" size="small" sx={{ width: 120 }} value={it.price} onChange={(e) => updateItem(idx, 'price', Number(e.target.value))} />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <TextField label="Скидка" type="number" size="small" sx={{ width: 140 }} value={orderDraft.discount}
                             onChange={(e) => setOrderDraft((p) => ({ ...p, discount: Number(e.target.value) }))} />
                  <TextField label="Налог, %" type="number" size="small" sx={{ width: 140 }} value={orderDraft.taxPercent}
                             onChange={(e) => setOrderDraft((p) => ({ ...p, taxPercent: Number(e.target.value) }))} />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="status-select-label">Статус</InputLabel>
                    <Select labelId="status-select-label" label="Статус" value={orderDraft.status}
                            onChange={(e) => setOrderDraft((p) => ({ ...p, status: e.target.value }))}>
                      {ORDER_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={0.5}>
                  <Typography>Сумма: {currency(calcSubtotal(orderDraft.items))}</Typography>
                  <Typography>Скидка: {currency(Math.min(orderDraft.discount || 0, calcSubtotal(orderDraft.items)))}</Typography>
                  <Typography>Налог: {currency(((Math.max(orderDraft.taxPercent || 0, 0) / 100) * Math.max(calcSubtotal(orderDraft.items) - Math.min(orderDraft.discount || 0, calcSubtotal(orderDraft.items)), 0)).toFixed(2))}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>Итого: {currency(calcGrandTotal(orderDraft.items, orderDraft.discount, orderDraft.taxPercent))}</Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialog(false)}>Отмена</Button>
          <Button onClick={saveOrder} variant="contained" disabled={!orderDraft.supplierId || !(orderDraft.items || []).length}>Сохранить заказ</Button>
        </DialogActions>
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Редактирование заказа {currentOrder ? currentOrder.number : ''}</DialogTitle>
        <DialogContent>
          {currentOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography sx={{ flex: 1 }}>Поставщик: {suppliers.find(s => s.id === currentOrder.supplierId)?.orgName || '-'}</Typography>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="edit-status-select">Статус</InputLabel>
                    <Select labelId="edit-status-select" label="Статус" value={currentOrder.status || 'Новый'}
                            onChange={(e) => setCurrentOrder((p) => ({ ...p, status: e.target.value }))}>
                      {ORDER_STATUSES.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Позиции</Typography>
                  <List>
                    {(currentOrder.items || []).map((it, idx) => (
                      <ListItem key={idx} secondaryAction={<Typography>{currency(Number(it.qty || 0) * Number(it.price || 0))}</Typography>}>
                        <ListItemText primary={it.name} />
                        <TextField label="Кол-во" type="number" size="small" sx={{ width: 90, mr: 1 }} value={it.qty}
                                   onChange={(e) => setCurrentOrder((p) => { const items = [...(p.items||[])]; items[idx] = { ...items[idx], qty: Math.max(Number(e.target.value)||0, 0) }; return { ...p, items }; })} />
                        <TextField label="Цена" type="number" size="small" sx={{ width: 120 }} value={it.price}
                                   onChange={(e) => setCurrentOrder((p) => { const items = [...(p.items||[])]; items[idx] = { ...items[idx], price: Math.max(Number(e.target.value)||0, 0) }; return { ...p, items }; })} />
                      </ListItem>
                    ))}
                  </List>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <TextField label="Скидка" type="number" size="small" sx={{ width: 140 }} value={currentOrder.discount || 0}
                               onChange={(e) => setCurrentOrder((p) => ({ ...p, discount: Math.max(Number(e.target.value)||0, 0) }))} />
                    <TextField label="Налог, %" type="number" size="small" sx={{ width: 140 }} value={currentOrder.taxPercent || 0}
                               onChange={(e) => setCurrentOrder((p) => ({ ...p, taxPercent: Math.max(Number(e.target.value)||0, 0) }))} />
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Stack spacing={0.5}>
                    <Typography>Сумма: {currency(calcSubtotal(currentOrder.items || []))}</Typography>
                    <Typography>Скидка: {currency(Math.min(currentOrder.discount || 0, calcSubtotal(currentOrder.items || [])))}</Typography>
                    <Typography>Налог: {currency(((Math.max(currentOrder.taxPercent || 0, 0) / 100) * Math.max(calcSubtotal(currentOrder.items || []) - Math.min(currentOrder.discount || 0, calcSubtotal(currentOrder.items || [])), 0)).toFixed(2))}</Typography>
                    <Typography sx={{ fontWeight: 600 }}>Итого: {currency(calcGrandTotal(currentOrder.items || [], currentOrder.discount || 0, currentOrder.taxPercent || 0))}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Платежи</Typography>
                  <List>
                    {(currentOrder.payments || []).map((pmt, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={`Оплата ${currency(pmt.amount)} от ${new Date(pmt.date).toLocaleDateString('ru-RU')}`} />
                      </ListItem>
                    ))}
                  </List>
                  <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Сумма оплаты" type="number" size="small" sx={{ width: 160 }}
                               value={0} onChange={() => {}} id="__dummy" helperText="Введите сумму и нажмите Добавить" />
                    <Button variant="outlined" onClick={() => {
                      const amountStr = window.prompt('Сумма оплаты, ₽', '0');
                      const amount = Math.max(Number(amountStr||0)||0, 0);
                      if (!amount) return;
                      setCurrentOrder((p) => ({ ...p, payments: [...(p.payments||[]), { id: genId('pay'), amount, date: new Date().toISOString() }] }));
                    }}>Добавить оплату</Button>
                    <Typography sx={{ ml: 'auto' }}>
                      {(() => {
                        const paid = (currentOrder.payments || []).reduce((s,p) => s + Number(p.amount||0), 0);
                        const remaining = Math.max(calcGrandTotal(currentOrder.items || [], currentOrder.discount || 0, currentOrder.taxPercent || 0) - paid, 0);
                        return `Оплачено: ${currency(paid)} • Остаток: ${currency(remaining)}`;
                      })()}
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Закрыть</Button>
          <Button variant="contained" onClick={() => {
            if (!currentOrder) return;
            const updated = { ...currentOrder };
            updated.total = calcGrandTotal(updated.items || [], updated.discount || 0, updated.taxPercent || 0);
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setEditDialog(false);
          }}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}