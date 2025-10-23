import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloseIcon from '@mui/icons-material/Close';
import DataGridBase from '../../components/DataGridBase';

const LS = {
  suppliers: 'warehouse_suppliers',
  orders: 'warehouse_supplier_orders',
  products: 'warehouse_products',
  categories: 'warehouse_categories',
};

const currency = (n) => `₽${Number(n || 0).toLocaleString('ru-RU')}`;
const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const useWarehouseData = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS.suppliers) || '[]');
      const o = JSON.parse(localStorage.getItem(LS.orders) || '[]');
      const c = JSON.parse(localStorage.getItem(LS.categories) || '[]');
      const p = JSON.parse(localStorage.getItem(LS.products) || '[]');
      setSuppliers(s);
      setOrders(o);
      if (c.length && p.length) {
        setCategories(c);
        setProducts(p);
      } else {
        const c1 = { id: genId('cat'), name: 'Химия', parentId: null };
        const c2 = { id: genId('cat'), name: 'Пленки', parentId: null };
        const c3 = { id: genId('cat'), name: 'Мойка', parentId: c1.id };
        const c4 = { id: genId('cat'), name: 'Полировка', parentId: c1.id };
        const c5 = { id: genId('cat'), name: 'Капот', parentId: c2.id };
        const c6 = { id: genId('cat'), name: 'Зоны риска', parentId: c2.id };
        const initCats = [c1, c2, c3, c4, c5, c6];
        const initProducts = [
          { id: genId('prd'), name: 'Шампунь профессиональный', categoryId: c3.id, price: 450, cost: 300 },
          { id: genId('prd'), name: 'Полировочная паста', categoryId: c4.id, price: 1200, cost: 800 },
          { id: genId('prd'), name: 'Пленка глянцевая капот', categoryId: c5.id, price: 2400, cost: 1600 },
          { id: genId('prd'), name: 'Пленка зоны риска', categoryId: c6.id, price: 1800, cost: 1200 },
        ];
        setCategories(initCats);
        setProducts(initProducts);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS.suppliers, JSON.stringify(suppliers));
      localStorage.setItem(LS.orders, JSON.stringify(orders));
      localStorage.setItem(LS.categories, JSON.stringify(categories));
      localStorage.setItem(LS.products, JSON.stringify(products));
    } catch {}
  }, [suppliers, orders, categories, products]);

  return { suppliers, setSuppliers, orders, setOrders, categories, products };
};

const calcTotal = (items) => (items || []).reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);

export default function SuppliersPage() {
  const { suppliers, setSuppliers, orders, setOrders, categories, products } = useWarehouseData();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [supplierForm, setSupplierForm] = useState({
    kind: 'person',
    orgName: '',
    description: '',
    contactName: '',
    phone: '',
    email: '',
    website: '',
    address: '',
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const [tab, setTab] = useState(0);
  const [actionsAnchor, setActionsAnchor] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => !q || s.orgName.toLowerCase().includes(q) || (s.contactName || '').toLowerCase().includes(q));
  }, [suppliers, search]);

  const columns = [
    { field: 'orgName', headerName: 'Название организации', flex: 1, minWidth: 220 },
    { field: 'contactName', headerName: 'Имя', width: 160 },
    { field: 'phone', headerName: 'Телефон', width: 170 },
    { field: 'website', headerName: 'Веб-сайт', width: 220, renderCell: (p) => p.value ? (<a href={p.value} target="_blank" rel="noreferrer">{p.value}</a>) : '-' },
  ];

  const openCreate = () => { setEditing(null); setSupplierForm({ kind: 'person', orgName: '', description: '', contactName: '', phone: '', email: '', website: '', address: '' }); setCreateOpen(true); };
  const closeCreate = () => setCreateOpen(false);

  const saveSupplier = () => {
    if (!supplierForm.orgName.trim()) return;
    if (editing) {
      setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? { ...editing, ...supplierForm } : s)));
    } else {
      setSuppliers((prev) => ([...prev, { id: genId('sup'), ...supplierForm, createdAt: new Date().toISOString() }]));
    }
    setCreateOpen(false);
    setEditing(null);
  };

  const openEditSupplier = (sup) => { setEditing(sup); setSupplierForm({ kind: sup.kind || 'person', orgName: sup.orgName || '', description: sup.description || '', contactName: sup.contactName || '', phone: sup.phone || '', email: sup.email || '', website: sup.website || '', address: sup.address || '' }); setCreateOpen(true); };

  const deleteSupplier = (sup) => {
    const relatedOrders = orders.filter((o) => o.supplierId === sup.id).length;
    const ok = window.confirm(`Удалить поставщика и ${relatedOrders} связанных заказов?`);
    if (!ok) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== sup.id));
    setOrders((prev) => prev.filter((o) => o.supplierId !== sup.id));
    setDetailsOpen(false);
  };

  const openDetails = (sup) => { setCurrentSupplier(sup); setTab(0); setDetailsOpen(true); };

  const supplierOrders = useMemo(() => orders.filter((o) => o.supplierId === (currentSupplier?.id || '')), [orders, currentSupplier]);
  const supplierPayments = useMemo(() => supplierOrders.flatMap((o) => (o.payments || []).map((p) => ({ ...p, orderId: o.id }))), [supplierOrders]);

  // Create order dialog state
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderDraft, setOrderDraft] = useState({ items: [], supplierId: null });
  const [categoryFilter, setCategoryFilter] = useState(null);

  const categoriesByParent = useMemo(() => {
    const m = {};
    categories.forEach((c) => { const k = c.parentId || 'root'; (m[k] ||= []).push(c); });
    return m;
  }, [categories]);

  const descendantIds = (id) => {
    const res = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const kids = categories.filter((c) => c.parentId === cur);
      kids.forEach((k) => { res.push(k.id); stack.push(k.id); });
    }
    return res;
  };

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
    setOrderDraft((prev) => {
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], [key]: value };
      return { ...prev, items };
    });
  };

  const openCreateOrder = (supplier) => {
    const sup = supplier || currentSupplier;
    setOrderDraft({ items: [], supplierId: sup?.id || null });
    setCategoryFilter(null);
    setOrderDialog(true);
  };

  const saveOrder = () => {
    if (!orderDraft.supplierId || !(orderDraft.items || []).length) return;
    const id = genId('po');
    const number = `PO-${new Date().getFullYear()}-${Math.floor(Math.random()*900+100)}`;
    const total = calcTotal(orderDraft.items);
    const order = { id, number, supplierId: orderDraft.supplierId, date: new Date().toISOString(), items: orderDraft.items, total, status: 'Новый', payments: [] };
    setOrders((prev) => ([order, ...prev]));
    setOrderDialog(false);
    setTab(1);
  };

  const addPayment = (orderId, amount) => {
    const payment = { id: genId('pay'), amount: Number(amount || 0), date: new Date().toISOString(), article: 'Оплата поставщику' };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payments: [...(o.payments || []), payment] } : o)));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Поставщики</Typography>
        <Stack direction="row" spacing={2}>
          <TextField size="small" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Поставщик</Button>
        </Stack>
      </Box>

      <Paper sx={{ height: 520 }}>
        <DataGridBase rows={filtered} columns={columns} getRowId={(r) => r.id} pageSize={10} rowsPerPageOptions={[10, 25]} disableSelectionOnClick onRowClick={(p) => openDetails(p.row)} />
      </Paper>

      {/* Create/Edit Supplier */}
      <Dialog open={createOpen} onClose={closeCreate} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать поставщика' : 'Создать поставщика'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <RadioGroup row value={supplierForm.kind} onChange={(e) => setSupplierForm((p) => ({ ...p, kind: e.target.value }))}>
              <FormControlLabel value="person" control={<Radio />} label="Физ.лицо" />
              <FormControlLabel value="company" control={<Radio />} label="Юр.лицо" />
            </RadioGroup>
            <TextField label="Название организации*" fullWidth sx={{ mt: 1 }} value={supplierForm.orgName} onChange={(e) => setSupplierForm((p) => ({ ...p, orgName: e.target.value }))} />
            <TextField label="Описание" fullWidth multiline rows={2} sx={{ mt: 2 }} value={supplierForm.description} onChange={(e) => setSupplierForm((p) => ({ ...p, description: e.target.value }))} />
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField label="Имя" fullWidth value={supplierForm.contactName} onChange={(e) => setSupplierForm((p) => ({ ...p, contactName: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField label="Телефон" fullWidth value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField label="Почта" fullWidth value={supplierForm.email} onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField label="Веб-сайт" fullWidth value={supplierForm.website} onChange={(e) => setSupplierForm((p) => ({ ...p, website: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField label="Адрес" fullWidth value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreate}>Отмена</Button>
          <Button onClick={saveSupplier} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Supplier Details */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {currentSupplier?.orgName || 'Поставщик'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Информация" />
            <Tab label="Заказы" />
            <Tab label="Платежи" />
          </Tabs>

          {tab === 0 && (
            <Paper sx={{ p: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Тип клиента</Typography><Typography>{currentSupplier?.kind === 'company' ? 'Юр.лицо' : 'Физ.лицо'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Имя</Typography><Typography>{currentSupplier?.contactName || '-'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Телефон</Typography><Typography>{currentSupplier?.phone || '-'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Почта</Typography><Typography>{currentSupplier?.email || '-'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Веб-сайт</Typography><Typography>{currentSupplier?.website ? <a href={currentSupplier.website} target="_blank" rel="noreferrer">{currentSupplier.website}</a> : '-'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Адрес</Typography><Typography>{currentSupplier?.address || '-'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">Описание</Typography><Typography>{currentSupplier?.description || '-'}</Typography></Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => openCreateOrder(currentSupplier)}>Создать заказ</Button>
                <Button sx={{ ml: 1 }} onClick={() => openEditSupplier(currentSupplier)} startIcon={<EditIcon />}>Редактировать</Button>
                <Button sx={{ ml: 1 }} color="error" onClick={() => deleteSupplier(currentSupplier)} startIcon={<DeleteIcon />}>Удалить поставщика</Button>
              </Box>
            </Paper>
          )}

          {tab === 1 && (
            <Box>
              {supplierOrders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>Здесь пока пусто</Box>
              ) : (
                <List>
                  {supplierOrders.map((o) => (
                    <ListItem key={o.id} secondaryAction={<Typography>{currency(o.total)}</Typography>}>
                      <ListItemText primary={<a href={`/inventory/orders`} onClick={(e)=>{e.preventDefault(); window.history.pushState({}, '', '/inventory/orders');}}>{o.number}</a>} secondary={new Date(o.date).toLocaleString('ru-RU')} />
                    </ListItem>
                  ))}
                </List>
              )}
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => openCreateOrder(currentSupplier)}>Создать заказ</Button>
              </Box>
            </Box>
          )}

          {tab === 2 && (
            <Box>
              {supplierPayments.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>Платежей нет</Box>
              ) : (
                <List>
                  {supplierPayments.map((p) => (
                    <ListItem key={p.id}>
                      <ListItemText primary={`${currency(p.amount)} — ${new Date(p.date).toLocaleString('ru-RU')}`} secondary={<span>Заказ: <a href={`/inventory/orders`} onClick={(e)=>{e.preventDefault(); window.history.pushState({}, '', '/inventory/orders');}}>{p.orderId}</a></span>} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Create Supplier Order */}
      <Dialog open={orderDialog} onClose={() => setOrderDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Заказ поставщику</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
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
                <Divider sx={{ my: 1 }} />
                <Typography>Итого: {currency(calcTotal(orderDraft.items))}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialog(false)}>Отмена</Button>
          <Button onClick={saveOrder} variant="contained">Сохранить заказ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}