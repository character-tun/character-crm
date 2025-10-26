import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,

  Grid,
  IconButton,

  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DataGridBase from '../components/DataGridBase';

import FormField from '../components/FormField';

const currency = (n) => `₽${Number(n || 0).toLocaleString('ru-RU')}`;

const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const LS_KEY = {
  categories: 'services_categories',
  services: 'services_items',
};

function usePersistentState() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    try {
      const catRaw = localStorage.getItem(LS_KEY.categories);
      const srvRaw = localStorage.getItem(LS_KEY.services);
      if (catRaw && srvRaw) {
        setCategories(JSON.parse(catRaw));
        setServices(JSON.parse(srvRaw));
        return;
      }
    } catch {}

    const c1 = { id: genId('cat'), name: 'Антискол', parentId: null };
    const c2 = { id: genId('cat'), name: 'Бронирование', parentId: null };
    const c3 = { id: genId('cat'), name: 'Детейлинг', parentId: null };
    const c4 = { id: genId('cat'), name: 'Оклейка', parentId: c3.id };
    const c5 = { id: genId('cat'), name: 'Зоны риска', parentId: c4.id };
    const c6 = { id: genId('cat'), name: 'Кузов', parentId: c4.id };
    const initialCats = [c1, c2, c3, c4, c5, c6];

    const initialServices = [
      { id: genId('srv'), name: 'Антискол на стекла', categoryId: c1.id, price: 5000, cost: 2500, warrantyDays: 0, rewardPercent: 0, rewardAmount: 0 },
      { id: genId('srv'), name: 'Детейлинг интерьера', categoryId: c3.id, price: 12000, cost: 6000, warrantyDays: 10, rewardPercent: 10, rewardAmount: 0 },
      { id: genId('srv'), name: 'Оклейка капота пленкой', categoryId: c6.id, price: 18000, cost: 9000, warrantyDays: 30, rewardPercent: 0, rewardAmount: 1500 },
    ];

    setCategories(initialCats);
    setServices(initialServices);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.categories, JSON.stringify(categories));
      localStorage.setItem(LS_KEY.services, JSON.stringify(services));
    } catch {}
  }, [categories, services]);

  return { categories, setCategories, services, setServices };
}

function ServicesPage() {
  const { categories, setCategories, services, setServices } = usePersistentState();

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [search, setSearch] = useState('');
  const [anchorCreate, setAnchorCreate] = useState(null);

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [srvDialogOpen, setSrvDialogOpen] = useState(false);

  const [editCategory, setEditCategory] = useState(null);
  const [editService, setEditService] = useState(null);

  const [catName, setCatName] = useState('');
  const [srvData, setSrvData] = useState({ name: '', categoryId: null, price: 0, cost: 0, warrantyDays: 0, rewardPercent: 0, rewardAmount: 0 });

  const [catMenus, setCatMenus] = useState({});

  const openCreateMenu = (e) => setAnchorCreate(e.currentTarget);
  const closeCreateMenu = () => setAnchorCreate(null);

  const categoriesByParent = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      const k = c.parentId || 'root';
      if (!map[k]) map[k] = [];
      map[k].push(c);
    });
    return map;
  }, [categories]);

  const findCategory = (id) => categories.find((c) => c.id === id) || null;

  const collectDescendants = useCallback((id) => {
    const res = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const kids = categories.filter((c) => c.parentId === cur);
      kids.forEach((k) => {
        res.push(k.id);
        stack.push(k.id);
      });
    }
    return res;
  }, [categories]);

  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterByCat = (row) => {
      if (!selectedCategoryId) return true;
      if (row.categoryId === selectedCategoryId) return true;
      const descendants = collectDescendants(selectedCategoryId);
      return descendants.includes(row.categoryId);
    };
    return services.filter((s) => filterByCat(s) && (!q || s.name.toLowerCase().includes(q)));
  }, [services, search, selectedCategoryId, collectDescendants]);

  const columns = [
    { field: 'name', headerName: 'Название', flex: 1, minWidth: 200 },
    {
      field: 'categoryId',
      headerName: 'Категория',
      width: 180,
      valueGetter: (params) => findCategory(params.value)?.name || '-',
    },
    { field: 'price', headerName: 'Цена', width: 130, valueFormatter: (p) => currency(p.value) },
    { field: 'cost', headerName: 'Себестоимость', width: 160, valueFormatter: (p) => currency(p.value) },
    { field: 'warrantyDays', headerName: 'Гарантия, дн.', width: 150 },
    { field: 'rewardPercent', headerName: 'Процент', width: 120 },
    { field: 'rewardAmount', headerName: 'Сумма', width: 120, valueFormatter: (p) => currency(p.value) },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => onEditService(params.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => onDeleteService(params.row)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      ),
    },
  ];

  const onCreateCategory = () => {
    setEditCategory(null);
    setCatName('');
    setCatDialogOpen(true);
    closeCreateMenu();
  };

  const onCreateService = () => {
    setEditService(null);
    setSrvData({ name: '', categoryId: selectedCategoryId || null, price: 0, cost: 0, warrantyDays: 0, rewardPercent: 0, rewardAmount: 0 });
    setSrvDialogOpen(true);
    closeCreateMenu();
  };

  const onEditCategory = (cat) => {
    setEditCategory(cat);
    setCatName(cat.name);
    setCatDialogOpen(true);
  };

  const onDeleteCategory = (cat) => {
    const descendants = collectDescendants(cat.id);
    const allToRemove = [cat.id, ...descendants];
    const srvCount = services.filter((s) => allToRemove.includes(s.categoryId)).length;
    const ok = window.confirm(`Удалить категорию и ${descendants.length} подкатегорий, а также ${srvCount} услуг?`);
    if (!ok) return;
    setCategories((prev) => prev.filter((c) => !allToRemove.includes(c.id)));
    setServices((prev) => prev.filter((s) => !allToRemove.includes(s.categoryId)));
    if (selectedCategoryId && allToRemove.includes(selectedCategoryId)) setSelectedCategoryId(null);
  };

  const onEditService = (row) => {
    setEditService(row);
    setSrvData({
      name: row.name,
      categoryId: row.categoryId || null,
      price: row.price || 0,
      cost: row.cost || 0,
      warrantyDays: row.warrantyDays || 0,
      rewardPercent: row.rewardPercent || 0,
      rewardAmount: row.rewardAmount || 0,
    });
    setSrvDialogOpen(true);
  };

  const onDeleteService = (row) => {
    const ok = window.confirm(`Удалить услугу "${row.name}"?`);
    if (!ok) return;
    setServices((prev) => prev.filter((s) => s.id !== row.id));
  };

  const saveCategory = () => {
    const name = catName.trim();
    if (!name) return;
    if (editCategory) {
      setCategories((prev) => prev.map((c) => (c.id === editCategory.id ? { ...c, name } : c)));
    } else {
      setCategories((prev) => ([...prev, { id: genId('cat'), name, parentId: selectedCategoryId || null }]));
    }
    setCatDialogOpen(false);
    setEditCategory(null);
    setCatName('');
  };

  const saveService = () => {
    const data = { ...srvData, price: Number(srvData.price || 0), cost: Number(srvData.cost || 0), warrantyDays: Number(srvData.warrantyDays || 0), rewardPercent: Number(srvData.rewardPercent || 0), rewardAmount: Number(srvData.rewardAmount || 0) };
    if (!data.name.trim()) return;
    if (!data.categoryId) data.categoryId = selectedCategoryId || null;
    if (editService) {
      setServices((prev) => prev.map((s) => (s.id === editService.id ? { ...editService, ...data } : s)));
    } else {
      setServices((prev) => ([...prev, { id: genId('srv'), ...data }]));
    }
    setSrvDialogOpen(false);
    setEditService(null);
  };

  const toggleCatMenu = (id, anchor) => {
    setCatMenus((prev) => ({ ...prev, [id]: prev[id] ? null : anchor }));
  };

  const renderCategoryBranch = (parentId, level = 0) => {
    const items = categoriesByParent[parentId || 'root'] || [];
    return items.map((cat) => (
      <ListItem key={cat.id} sx={{ pl: 1 + level * 2 }} disableGutters>
        <ListItemButton selected={selectedCategoryId === cat.id} onClick={() => setSelectedCategoryId(cat.id)}>
          <ListItemText primary={cat.name} />
        </ListItemButton>
        <IconButton size="small" onClick={(e) => toggleCatMenu(cat.id, e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={catMenus[cat.id]} open={Boolean(catMenus[cat.id])} onClose={() => toggleCatMenu(cat.id, null)}>
          <MenuItem onClick={() => { toggleCatMenu(cat.id, null); onEditCategory(cat); }}>Редактировать</MenuItem>
          <MenuItem onClick={() => { toggleCatMenu(cat.id, null); onDeleteCategory(cat); }}>Удалить</MenuItem>
          <Divider />
          <MenuItem onClick={() => { toggleCatMenu(cat.id, null); setSelectedCategoryId(cat.id); onCreateCategory(); }}>Создать подкатегорию</MenuItem>
          <MenuItem onClick={() => { toggleCatMenu(cat.id, null); setSelectedCategoryId(cat.id); onCreateService(); }}>Создать услугу</MenuItem>
        </Menu>
      </ListItem>
    ));
  };

  const headerRight = (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <TextField size="small" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Button variant="contained" endIcon={<ExpandMoreIcon />} onClick={openCreateMenu}>
        Создать
      </Button>
      <Menu anchorEl={anchorCreate} open={Boolean(anchorCreate)} onClose={closeCreateMenu}>
        <MenuItem onClick={onCreateCategory}>Создать категорию</MenuItem>
        <MenuItem onClick={onCreateService}>Создать услугу</MenuItem>
      </Menu>
    </Stack>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Услуги</Typography>
        {headerRight}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper>
            <Box sx={{ p: 1 }}>
              <List>
                <ListItem disableGutters>
                  <ListItemButton selected={!selectedCategoryId} onClick={() => setSelectedCategoryId(null)}>
                    <ListItemText primary="Все категории" />
                  </ListItemButton>
                </ListItem>
                {renderCategoryBranch(null, 0)}
              </List>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={9}>
          <Paper sx={{ height: 540 }}>
            <DataGridBase
              rows={visibleServices}
              columns={columns}
              getRowId={(r) => r.id}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              disableSelectionOnClick
            />
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={catDialogOpen} onClose={() => setCatDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Категория</DialogTitle>
        <DialogContent>
          <FormField label="Название">
            <TextField autoFocus margin="dense" fullWidth value={catName} onChange={(e) => setCatName(e.target.value)} />
          </FormField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialogOpen(false)}>Отмена</Button>
          <Button onClick={saveCategory} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={srvDialogOpen} onClose={() => setSrvDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Услуга</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormField label="Название">
                <TextField fullWidth value={srvData.name} onChange={(e) => setSrvData((p) => ({ ...p, name: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Категория">
                <Select fullWidth value={srvData.categoryId || ''} onChange={(e) => setSrvData((p) => ({ ...p, categoryId: e.target.value }))}>
                  <MenuItem value=""><em>Не выбрано</em></MenuItem>
                  {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                </Select>
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Себестоимость">
                <TextField type="number" fullWidth value={srvData.cost} onChange={(e) => setSrvData((p) => ({ ...p, cost: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Цена">
                <TextField type="number" fullWidth value={srvData.price} onChange={(e) => setSrvData((p) => ({ ...p, price: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Гарантия, дн.">
                <TextField type="number" fullWidth value={srvData.warrantyDays} onChange={(e) => setSrvData((p) => ({ ...p, warrantyDays: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Процент">
                <TextField type="number" fullWidth value={srvData.rewardPercent} onChange={(e) => setSrvData((p) => ({ ...p, rewardPercent: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Сумма">
                <TextField type="number" fullWidth value={srvData.rewardAmount} onChange={(e) => setSrvData((p) => ({ ...p, rewardAmount: e.target.value }))} />
              </FormField>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">Вознаграждение исполнителю. Настройка влияет на прибыль и карточки сотрудника.</Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSrvDialogOpen(false)}>Отмена</Button>
          <Button onClick={saveService} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ServicesPage;