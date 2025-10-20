import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, TextField, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch, Checkbox, Typography } from '@mui/material';
import SettingsBackBar from '../../components/SettingsBackBar';

const TYPE_LIST_KEY = 'settings_order_types';
const TYPE_CONFIG_KEY = 'settings_order_type_configs';
const STATUS_KEY = 'settings_order_statuses';
const DOCS_KEY = 'settings_documents';
const FIELDS_KEY = 'settings_order_fields';

const fallbackStatuses = ['Новый', 'В работе', 'Готов', 'Отменён'];
const fallbackDocs = ['Акт выполненных работ','Акт приема-передачи ТС','Приемная квитанция','Товарный чек'];

export default function OrderTypesSettingsPage() {
  const [types, setTypes] = useState([]);
  const [configs, setConfigs] = useState({});
  const [newTypeName, setNewTypeName] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const statuses = useMemo(() => {
    try {
      const raw = localStorage.getItem(STATUS_KEY);
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return fallbackStatuses;
  }, []);

  const documents = useMemo(() => {
    try {
      const raw = localStorage.getItem(DOCS_KEY);
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return fallbackDocs;
  }, []);

  const fields = useMemo(() => {
    try {
      const raw = localStorage.getItem(FIELDS_KEY);
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr)) return arr;
    } catch {}
    return [];
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TYPE_LIST_KEY);
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr)) setTypes(arr);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TYPE_CONFIG_KEY);
      const obj = JSON.parse(raw || '{}');
      if (obj && typeof obj === 'object') setConfigs(obj);
    } catch {}
  }, []);



  const defaultConfig = (name) => ({
    name,
    initialStatus: statuses[0] || 'Новый',
    allowPrepayment: true,
    allowItemsOnCreate: true,
    documents: [],
    attachedFields: [],
  });

  useEffect(() => {
    if (!types.length) return;
    setConfigs((prev) => {
      const updated = { ...prev };
      let changed = false;
      types.forEach((name) => {
        if (!updated[name]) { updated[name] = defaultConfig(name); changed = true; }
      });
      if (changed) {
        try { localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      }
      return prev;
    });
  }, [types]);

  const openEdit = (name) => {
    const cfg = configs[name] || defaultConfig(name);
    setEditData({ ...cfg });
    setEditOpen(true);
  };

  const handleAddType = () => {
    const name = (newTypeName || '').trim();
    if (!name) return;
    if (types.includes(name)) {
      setNewTypeName('');
      return;
    }
    const updatedTypes = [...types, name];
    const updatedConfigs = { ...configs, [name]: configs[name] || defaultConfig(name) };
    setTypes(updatedTypes);
    setConfigs(updatedConfigs);
    try {
      localStorage.setItem(TYPE_LIST_KEY, JSON.stringify(updatedTypes));
      localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(updatedConfigs));
    } catch {}
    setNewTypeName('');
  };

  const handleDeleteType = (name) => {
    const updatedTypes = types.filter((t) => t !== name);
    const updatedConfigs = { ...configs };
    delete updatedConfigs[name];
    setTypes(updatedTypes);
    setConfigs(updatedConfigs);
    try {
      localStorage.setItem(TYPE_LIST_KEY, JSON.stringify(updatedTypes));
      localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(updatedConfigs));
    } catch {}
  };

  const toggleDoc = (doc, checked) => {
    setEditData((prev) => {
      const docs = new Set(prev.documents || []);
      if (checked) docs.add(doc); else docs.delete(doc);
      return { ...prev, documents: Array.from(docs) };
    });
  };

  const toggleField = (fname, checked) => {
    setEditData((prev) => {
      const fset = new Set(prev.attachedFields || []);
      if (checked) fset.add(fname); else fset.delete(fname);
      return { ...prev, attachedFields: Array.from(fset) };
    });
  };

  const handleEditSave = () => {
    if (!editData) return;
    const oldName = editData.name && types.includes(editData.name) ? editData.name : null;
    const prevName = (oldName && oldName !== undefined) ? oldName : (editData._prevName || editData.name);

    // Если переименовали тип
    const nameChanged = prevName && editData.name && prevName !== editData.name;

    let updatedTypes = types;
    if (nameChanged) {
      updatedTypes = types.map((t) => (t === prevName ? editData.name : t));
    }

    const updatedConfigs = { ...configs };
    if (nameChanged) delete updatedConfigs[prevName];
    updatedConfigs[editData.name] = { ...editData };

    setTypes(updatedTypes);
    setConfigs(updatedConfigs);
    try {
      localStorage.setItem(TYPE_LIST_KEY, JSON.stringify(updatedTypes));
      localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(updatedConfigs));
    } catch {}

    setEditOpen(false);
    setEditData(null);
  };

  const saveAll = () => {
    try {
      localStorage.setItem(TYPE_LIST_KEY, JSON.stringify(types));
      localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(configs));
    } catch {}
  };

  return (
    <Box>
      <SettingsBackBar title="Типы заказов" onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #2a2f37' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField size="small" fullWidth label="Название типа" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
            <Button variant="contained" onClick={handleAddType}>Добавить тип</Button>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {types.map((t) => (
              <Chip key={t} label={t} onClick={() => openEdit(t)} onDelete={() => handleDeleteType(t)} sx={{ m: 0.5 }} />
            ))}
            {types.length === 0 && (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>Нет типов. Добавьте первый.</Typography>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        {editData && (
          <>
            <DialogTitle>Настройка типа заказа</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Название" value={editData.name} onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))} fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="init-status-label">Начальный статус</InputLabel>
                      <Select labelId="init-status-label" label="Начальный статус" value={editData.initialStatus || statuses[0]}
                              onChange={(e) => setEditData((p) => ({ ...p, initialStatus: e.target.value }))}>
                        {statuses.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel control={<Switch checked={!!editData.allowPrepayment} onChange={(e) => setEditData((p) => ({ ...p, allowPrepayment: e.target.checked }))} />} label="Предоплата" />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel control={<Switch checked={!!editData.allowItemsOnCreate} onChange={(e) => setEditData((p) => ({ ...p, allowItemsOnCreate: e.target.checked }))} />} label="Добавление товаров/услуг при создании" />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2">Печатные шаблоны</Typography>
                <Grid container>
                  {documents.map((d) => (
                    <Grid item xs={12} md={6} key={d}>
                      <FormControlLabel control={<Checkbox checked={(editData.documents || []).includes(d)} onChange={(e) => toggleDoc(d, e.target.checked)} />} label={d} />
                    </Grid>
                  ))}
                  {documents.length === 0 && (
                    <Grid item xs={12}><Typography variant="body2" sx={{ opacity: 0.7 }}>Нет документов. Добавьте их в Настройки → Документы.</Typography></Grid>
                  )}
                </Grid>

                <Typography variant="subtitle2">Привязанные поля</Typography>
                <Grid container>
                  {fields.map((f) => (
                    <Grid item xs={12} md={6} key={f.name}>
                      <FormControlLabel control={<Checkbox checked={(editData.attachedFields || []).includes(f.name)} onChange={(e) => toggleField(f.name, e.target.checked)} />} label={`${f.label} (${f.type})`} />
                    </Grid>
                  ))}
                  {fields.length === 0 && (
                    <Grid item xs={12}><Typography variant="body2" sx={{ opacity: 0.7 }}>Нет полей. Добавьте их в Настройки → Поля заказа.</Typography></Grid>
                  )}
                </Grid>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleEditSave}>Сохранить</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}