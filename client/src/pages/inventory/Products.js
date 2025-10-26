import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, List, ListItem, ListItemText, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DataGridBase from '../../components/DataGridBase';
import FormField from '../../components/FormField';

const LS = {
  products: 'warehouse_products',
  categories: 'warehouse_categories',
};

const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const currency = (n) => `₽${Number(n || 0).toLocaleString('ru-RU')}`;

export default function InventoryProductsPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(LS.categories) || '[]');
      const p = JSON.parse(localStorage.getItem(LS.products) || '[]');
      if (c.length && p.length) {
        setCategories(c);
        setProducts(p);
      } else {
        const c1 = { id: genId('cat'), name: 'Химия', parentId: null };
        const c2 = { id: genId('cat'), name: 'Пленки', parentId: null };
        const c3 = { id: genId('cat'), name: 'Мойка', parentId: c1.id };
        const c4 = { id: genId('cat'), name: 'Полировка', parentId: c1.id };
        const initCats = [c1, c2, c3, c4];
        const initProducts = [
          { id: genId('prd'), name: 'Шампунь профессиональный', categoryId: c3.id, price: 450, cost: 300 },
          { id: genId('prd'), name: 'Полировочная паста', categoryId: c4.id, price: 1200, cost: 800 },
        ];
        setCategories(initCats);
        setProducts(initProducts);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS.categories, JSON.stringify(categories));
      localStorage.setItem(LS.products, JSON.stringify(products));
    } catch {}
  }, [categories, products]);

  const topCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenOf = (id) => categories.filter((c) => c.parentId === id);

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
    const q = search.trim().toLowerCase();
    let list = products;
    if (selectedCategoryId) {
      const ids = [selectedCategoryId, ...descendantIds(selectedCategoryId)];
      list = list.filter((p) => ids.includes(p.categoryId));
    }
    return list.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, search, selectedCategoryId, descendantIds]);

  const columns = [
    { field: 'name', headerName: 'Название', flex: 1, minWidth: 220 },
    { field: 'categoryName', headerName: 'Категория', width: 180 },
    { field: 'price', headerName: 'Цена', width: 140, renderCell: (p) => currency(p.value) },
    { field: 'cost', headerName: 'Себестоимость', width: 160, renderCell: (p) => currency(p.value) },
    { field: 'actions', headerName: 'Действия', width: 150, renderCell: (params) => (
      <Stack direction="row" spacing={1}>
        <IconButton size="small" onClick={() => openEditProduct(params.row)}><EditIcon fontSize="small" /></IconButton>
        <IconButton size="small" color="error" onClick={() => deleteProduct(params.row)}><DeleteIcon fontSize="small" /></IconButton>
      </Stack>
    )},
  ];

  const withCategory = useMemo(() => {
    const m = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    return filteredProducts.map((p) => ({ ...p, categoryName: m[p.categoryId] || '-' }));
  }, [filteredProducts, categories]);

  // Category CRUD
  const [catDialog, setCatDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', parentId: null });

  const openCreateCategory = (parentId = null) => { setEditingCategory(null); setCatForm({ name: '', parentId }); setCatDialog(true); };
  const openEditCategory = (cat) => { setEditingCategory(cat); setCatForm({ name: cat.name || '', parentId: cat.parentId || null }); setCatDialog(true); };
  const saveCategory = () => {
    if (!catForm.name.trim()) return;
    if (editingCategory) {
      setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? { ...editingCategory, ...catForm } : c)));
    } else {
      setCategories((prev) => [...prev, { id: genId('cat'), ...catForm }]);
    }
    setCatDialog(false);
    setEditingCategory(null);
  };
  const deleteCategory = (cat) => {
    const ids = [cat.id, ...descendantIds(cat.id)];
    const ok = window.confirm('Удалить категорию и все подкатегории и товары в них?');
    if (!ok) return;
    setCategories((prev) => prev.filter((c) => !ids.includes(c.id)));
    setProducts((prev) => prev.filter((p) => !ids.includes(p.categoryId)));
    if (selectedCategoryId && ids.includes(selectedCategoryId)) setSelectedCategoryId(null);
  };

  // Product CRUD
  const [prodDialog, setProdDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState({ name: '', categoryId: '', price: 0, cost: 0 });

  const openCreateProduct = () => { setEditingProduct(null); setProdForm({ name: '', categoryId: selectedCategoryId || '', price: 0, cost: 0 }); setProdDialog(true); };
  const openEditProduct = (prod) => { setEditingProduct(prod); setProdForm({ name: prod.name || '', categoryId: prod.categoryId || '', price: Number(prod.price || 0), cost: Number(prod.cost || 0) }); setProdDialog(true); };
  const saveProduct = () => {
    if (!prodForm.name.trim() || !prodForm.categoryId) return;
    if (Number(prodForm.price) < 0 || Number(prodForm.cost) < 0) return;
    if (editingProduct) {
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...editingProduct, ...prodForm, price: Number(prodForm.price), cost: Number(prodForm.cost) } : p)));
    } else {
      setProducts((prev) => [...prev, { id: genId('prd'), ...prodForm, price: Number(prodForm.price), cost: Number(prodForm.cost) }]);
    }
    setProdDialog(false);
    setEditingProduct(null);
  };
  const deleteProduct = (prod) => {
    const ok = window.confirm('Удалить товар?');
    if (!ok) return;
    setProducts((prev) => prev.filter((p) => p.id !== prod.id));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Товары</Typography>
        <Stack direction="row" spacing={2}>
          <TextField size="small" placeholder="Поиск товара" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateProduct}>Товар</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openCreateCategory(null)}>Категория</Button>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Категории</Typography>
            <List>
              <ListItem disableGutters>
                <Button size="small" onClick={() => setSelectedCategoryId(null)}>Все категории</Button>
              </ListItem>
              {topCategories.map((c) => (
                <React.Fragment key={c.id}>
                  <ListItem disableGutters secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" onClick={() => openCreateCategory(c.id)}><AddIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => openEditCategory(c)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteCategory(c)}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  }>
                    <Button size="small" onClick={() => setSelectedCategoryId(c.id)}>{c.name}</Button>
                  </ListItem>
                  {childrenOf(c.id).map((sc) => (
                    <ListItem key={sc.id} sx={{ pl: 3 }} disableGutters secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" onClick={() => openEditCategory(sc)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteCategory(sc)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                    }>
                      <Button size="small" onClick={() => setSelectedCategoryId(sc.id)}>{sc.name}</Button>
                    </ListItem>
                  ))}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: 520 }}>
            <DataGridBase rows={withCategory} columns={columns} getRowId={(r) => r.id} pageSize={10} rowsPerPageOptions={[10, 25]} disableSelectionOnClick />
          </Paper>
        </Grid>
      </Grid>

      {/* Category Dialog */}
      <Dialog open={catDialog} onClose={() => setCatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Редактировать категорию' : 'Создать категорию'}</DialogTitle>
        <DialogContent>
          <FormField label="Название*">
            <TextField fullWidth value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Родительская категория">
            <Select fullWidth value={catForm.parentId || ''} onChange={(e) => setCatForm((p) => ({ ...p, parentId: e.target.value || null }))}>
              <MenuItem value="">(нет)</MenuItem>
              {topCategories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
            </Select>
          </FormField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveCategory}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={prodDialog} onClose={() => setProdDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Редактировать товар' : 'Создать товар'}</DialogTitle>
        <DialogContent>
          <FormField label="Название*">
            <TextField fullWidth value={prodForm.name} onChange={(e) => setProdForm((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Категория*">
            <Select fullWidth value={prodForm.categoryId || ''} onChange={(e) => setProdForm((p) => ({ ...p, categoryId: e.target.value }))}>
              {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
            </Select>
          </FormField>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}>
              <FormField label="Цена">
                <TextField type="number" fullWidth value={prodForm.price} onChange={(e) => setProdForm((p) => ({ ...p, price: Number(e.target.value) }))} />
              </FormField>
            </Grid>
            <Grid item xs={6}>
              <FormField label="Себестоимость">
                <TextField type="number" fullWidth value={prodForm.cost} onChange={(e) => setProdForm((p) => ({ ...p, cost: Number(e.target.value) }))} />
              </FormField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProdDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveProduct}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}