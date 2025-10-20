import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, Typography, IconButton, Chip, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SettingsBackBar from '../../components/SettingsBackBar';
import { useAuth } from '../../context/AuthContext';
import { orderTypesService } from '../../services/orderTypesService';
import { getStatuses } from '../../services/statusesService';
import { docTemplatesService } from '../../services/docTemplatesService';
import http from '../../services/http';

function flattenStatuses(groups) {
  const arr = [];
  (groups || []).forEach((g) => (g.items || []).forEach((s) => arr.push(s)));
  return arr;
}

export default function OrderTypesSettingsPage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['Admin']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [items, setItems] = useState([]); // list of order types
  const [statusesGroups, setStatusesGroups] = useState([]);
  const statuses = useMemo(() => flattenStatuses(statusesGroups), [statusesGroups]);
  const [docTemplates, setDocTemplates] = useState([]);
  const [fieldSchemas, setFieldSchemas] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', startStatusId: '', allowedStatuses: [], docTemplateIds: [], fieldsSchemaId: '' });
  const isEdit = Boolean(editingId);

  const loadRefs = async () => {
    try {
      const [st, dt] = await Promise.all([
        getStatuses().then(r => Array.isArray(r?.data) ? r.data : []),
        docTemplatesService.list().then(r => Array.isArray(r?.items) ? r.items : []),
      ]);
      setStatusesGroups(st);
      setDocTemplates(dt);
    } catch (e) {
      // best-effort; show error only if both fail
      console.warn('[OrderTypes] loadRefs warn', e?.message || e);
    }
    // field-schemas — опционально, может отсутствовать на сервере
    try {
      const r = await http.get('/field-schemas');
      const list = Array.isArray(r?.data?.items) ? r.data.items : (Array.isArray(r?.data) ? r.data : []);
      setFieldSchemas(list);
    } catch (e) {
      setFieldSchemas([]);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await orderTypesService.list();
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка загрузки типов заказов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefs();
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => setForm({ code: '', name: '', startStatusId: '', allowedStatuses: [], docTemplateIds: [], fieldsSchemaId: '' });

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    const startId = typeof row.startStatusId === 'object' ? row.startStatusId?._id : row.startStatusId;
    const allowed = (row.allowedStatuses || []).map(v => (typeof v === 'object' ? v._id : v));
    const docs = (row.docTemplateIds || []).map(v => (typeof v === 'object' ? v._id : v));
    const fieldsId = row.fieldsSchemaId && (typeof row.fieldsSchemaId === 'object' ? row.fieldsSchemaId._id : row.fieldsSchemaId);
    setForm({ code: row.code || '', name: row.name || '', startStatusId: startId || '', allowedStatuses: allowed, docTemplateIds: docs, fieldsSchemaId: fieldsId || '' });
    setEditingId(row._id);
    setModalOpen(true);
  };

  const onChange = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const save = async () => {
    setError('');
    setSuccess('');
    const payload = { ...form };
    // клиентское обеспечение инварианта: startStatusId ∈ allowedStatuses
    if (payload.startStatusId && !(payload.allowedStatuses || []).some(id => String(id) === String(payload.startStatusId))) {
      payload.allowedStatuses = [...(payload.allowedStatuses || []), payload.startStatusId];
    }
    try {
      if (isEdit) {
        const res = await orderTypesService.update(editingId, payload);
        const updated = res?.item;
        setItems(prev => prev.map(it => (it._id === updated._id ? updated : it)));
        setSuccess('Тип заказа обновлён');
      } else {
        const res = await orderTypesService.create(payload);
        const created = res?.item;
        setItems(prev => [created, ...prev]);
        setSuccess('Тип заказа создан');
      }
      setModalOpen(false);
      setEditingId(null);
      resetForm();
    } catch (e) {
      const err = e?.response?.data?.error || e?.message || 'Ошибка сохранения';
      setError(err);
    }
  };

  const remove = async (row) => {
    if (!isAdmin) return;
    if (!window.confirm(`Удалить тип «${row.name || row.code}»?`)) return;
    setError('');
    setSuccess('');
    try {
      await orderTypesService.remove(row._id);
      setItems(prev => prev.filter(it => it._id !== row._id));
      setSuccess('Тип заказа удалён');
    } catch (e) {
      const err = e?.response?.data?.error || e?.message || 'Ошибка удаления';
      setError(err);
    }
  };

  const renderStatusName = (idOrObj) => {
    const id = typeof idOrObj === 'object' ? idOrObj?._id : idOrObj;
    const s = statuses.find(st => String(st._id) === String(id));
    return s ? s.name : '—';
  };

  return (
    <Box>
      <SettingsBackBar title="Типы заказов" />

      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #2a2f37', mt: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Список типов</Typography>
            {isAdmin && (
              <Button variant="contained" onClick={openCreate}>Создать тип</Button>
            )}
          </Stack>

          {error && <Alert severity="error">{String(error)}</Alert>}
          {success && <Alert severity="success">{String(success)}</Alert>}

          <Box>
            <Grid container sx={{ fontWeight: 600, opacity: 0.7, mb: 1 }}>
              <Grid item xs={3}>Код</Grid>
              <Grid item xs={3}>Название</Grid>
              <Grid item xs={2}>Начальный статус</Grid>
              <Grid item xs={2}>Допустимые</Grid>
              <Grid item xs={1}>Док-ты</Grid>
              <Grid item xs={1} sx={{ textAlign: 'right' }}>Действия</Grid>
            </Grid>
            {(items || []).map((row) => (
              <Grid key={row._id} container alignItems="center" sx={{ py: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Grid item xs={3}><Typography>{row.code}</Typography></Grid>
                <Grid item xs={3}><Typography>{row.name}</Typography></Grid>
                <Grid item xs={2}><Typography>{renderStatusName(row.startStatusId)}</Typography></Grid>
                <Grid item xs={2}>
                  <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto' }}>
                    {(row.allowedStatuses || []).slice(0, 3).map((s) => {
                      const nm = typeof s === 'object' ? s.name : renderStatusName(s);
                      return <Chip key={typeof s === 'object' ? s._id : s} size="small" label={nm} />;
                    })}
                    {(row.allowedStatuses || []).length > 3 && (
                      <Chip size="small" label={`+${(row.allowedStatuses || []).length - 3}`} />
                    )}
                  </Stack>
                </Grid>
                <Grid item xs={1}><Typography>{(row.docTemplateIds || []).length || 0}</Typography></Grid>
                <Grid item xs={1} sx={{ textAlign: 'right' }}>
                  {isAdmin ? (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => remove(row)}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  ) : (
                    <Typography sx={{ opacity: 0.6 }}>Нет прав</Typography>
                  )}
                </Grid>
              </Grid>
            ))}
            {(!items || items.length === 0) && !loading && (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>Нет типов заказов.</Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{isEdit ? 'Редактировать тип' : 'Создать тип'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField label="Код" value={form.code} onChange={(e) => onChange({ code: e.target.value })} fullWidth size="small" disabled={!isAdmin && isEdit} />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField label="Название" value={form.name} onChange={(e) => onChange({ name: e.target.value })} fullWidth size="small" />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="start-status">Начальный статус</InputLabel>
                  <Select labelId="start-status" label="Начальный статус" value={form.startStatusId || ''} onChange={(e) => onChange({ startStatusId: e.target.value })}>
                    {statuses.map((s) => (
                      <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="allowed-statuses">Допустимые статусы</InputLabel>
                  <Select labelId="allowed-statuses" multiple label="Допустимые статусы" value={form.allowedStatuses || []} onChange={(e) => onChange({ allowedStatuses: e.target.value })} renderValue={(selected) => (selected || []).map(id => (statuses.find(s => String(s._id) === String(id))?.name || id)).join(', ')}>
                    {statuses.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        <Checkbox checked={(form.allowedStatuses || []).some((id) => String(id) === String(s._id))} />
                        <ListItemText primary={s.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="doc-templates">Печатные шаблоны</InputLabel>
                  <Select labelId="doc-templates" multiple label="Печатные шаблоны" value={form.docTemplateIds || []} onChange={(e) => onChange({ docTemplateIds: e.target.value })} renderValue={(selected) => (selected || []).map(id => (docTemplates.find(d => String(d._id) === String(id))?.name || id)).join(', ')}>
                    {docTemplates.map((d) => (
                      <MenuItem key={d._id} value={d._id}>
                        <Checkbox checked={(form.docTemplateIds || []).some((id) => String(id) === String(d._id))} />
                        <ListItemText primary={d.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" disabled={!fieldSchemas.length}>
                  <InputLabel id="field-schema">Схема полей</InputLabel>
                  <Select labelId="field-schema" label="Схема полей" value={form.fieldsSchemaId || ''} onChange={(e) => onChange({ fieldsSchemaId: e.target.value })}>
                    <MenuItem value=""><em>Не выбрано</em></MenuItem>
                    {fieldSchemas.map((f) => (
                      <MenuItem key={f._id || f.id} value={f._id || f.id}>{f.name || f.code || (f._id || f.id)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!fieldSchemas.length && (
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>Схемы полей недоступны в этой сборке.</Typography>
                )}
              </Grid>
            </Grid>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Примечание: начальный статус автоматически будет добавлен в допустимые статусы при сохранении.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={save} disabled={!isAdmin}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}