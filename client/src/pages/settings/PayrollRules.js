import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Paper, Button, Grid, TextField, Select, MenuItem, Switch, FormControlLabel } from '@mui/material';
import SettingsBackBar from '../../components/SettingsBackBar';
import DataGridBase from '../../components/DataGridBase';
import ModalBase from '../../components/ModalBase';
import FormField from '../../components/FormField';
import { payrollService } from '../../services/payrollService';
import { useAuth } from '../../context/AuthContext';

const defaultForm = {
  code: '',
  name: '',
  scope: 'order',
  base: 'grandTotal',
  source: 'employee',
  target: 'employee',
  value: 0.1,
  active: true,
};

export default function PayrollRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const { hasAnyRole } = useAuth();

  const canDelete = hasAnyRole(['Admin']);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { items } = await payrollService.listRules();
      setRules(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error('Failed to load payroll rules', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const columns = useMemo(() => ([
    { field: '_id', headerName: 'ID', width: 140 },
    { field: 'code', headerName: 'Код', width: 140 },
    { field: 'name', headerName: 'Название', width: 220 },
    { field: 'scope', headerName: 'Область', width: 120 },
    { field: 'base', headerName: 'База', width: 140 },
    { field: 'source', headerName: 'Источник', width: 140 },
    { field: 'target', headerName: 'Кому', width: 140 },
    { field: 'value', headerName: 'Значение', width: 120, valueFormatter: (v) => (typeof v === 'number' ? v : '') },
    { field: 'active', headerName: 'Активно', width: 120, valueFormatter: (v) => (v ? 'Да' : 'Нет') },
    { field: 'createdAt', headerName: 'Создано', width: 180 },
  ]), []);

  const handleOpen = () => { setForm(defaultForm); setErrors({}); setOpen(true); };
  const handleClose = () => setOpen(false);
  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleToggle = (e) => setForm((prev) => ({ ...prev, active: e.target.checked }));

  const validate = () => {
    const next = {};
    if (!String(form.code || '').trim()) next.code = 'Требуется код';
    if (!String(form.name || '').trim()) next.name = 'Требуется название';
    const val = Number(form.value);
    if (!(val > 0)) next.value = 'Значение должно быть > 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    try {
      const payload = {
        code: String(form.code).trim(),
        name: String(form.name).trim(),
        scope: String(form.scope),
        base: String(form.base),
        source: String(form.source),
        target: String(form.target),
        value: Number(form.value),
        active: !!form.active,
      };
      const res = await payrollService.createRule(payload);
      if (res && res.ok) {
        handleClose();
        await loadRules();
      }
    } catch (e) {
      console.error('Failed to create rule', e);
    }
  };

  const handleDelete = async (row) => {
    if (!canDelete) return;
    try {
      await payrollService.deleteRule(row._id);
      await loadRules();
    } catch (e) {
      console.error('Failed to delete rule', e);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <SettingsBackBar title="Правила начислений" onSave={() => {}} />
        <Button variant="contained" onClick={handleOpen}>Добавить правило</Button>
      </Stack>

      <Paper sx={{ height: 480, p: 1, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <DataGridBase
          rows={rules}
          columns={[...columns,
            {
              field: '__actions', headerName: 'Действия', width: 140, renderCell: (params) => (
                <Stack direction="row" spacing={1}>
                  {canDelete && (
                    <Button size="small" color="error" variant="outlined" onClick={() => handleDelete(params.row)}>Удалить</Button>
                  )}
                </Stack>
              )
            }
          ]}
          pageSize={10}
          loading={loading}
        />
      </Paper>

      <ModalBase
        open={open}
        onClose={handleClose}
        title="Новое правило"
        maxWidth="md"
        actions={(
          <>
            <Button onClick={handleClose}>Отмена</Button>
            <Button variant="contained" onClick={handleCreate}>Создать</Button>
          </>
        )}
      >
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={4}>
            <FormField label="Код" required fullWidth errorText={errors.code} htmlFor="rule-code">
              <TextField id="rule-code" fullWidth name="code" value={form.code} onChange={handleChange} />
            </FormField>
          </Grid>
          <Grid item xs={12} md={8}>
            <FormField label="Название" required fullWidth errorText={errors.name} htmlFor="rule-name">
              <TextField id="rule-name" fullWidth name="name" value={form.name} onChange={handleChange} />
            </FormField>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormField label="Область" fullWidth htmlFor="rule-scope">
              <Select id="rule-scope" fullWidth name="scope" value={form.scope} onChange={handleChange}>
                <MenuItem value="order">Заказ</MenuItem>
                <MenuItem value="shop">Магазин</MenuItem>
                <MenuItem value="custom">Другое</MenuItem>
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormField label="База" fullWidth htmlFor="rule-base">
              <Select id="rule-base" fullWidth name="base" value={form.base} onChange={handleChange}>
                <MenuItem value="grandTotal">Итого</MenuItem>
                <MenuItem value="subtotal">Сумма</MenuItem>
                <MenuItem value="custom">Пользовательская</MenuItem>
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormField label="Источник" fullWidth htmlFor="rule-source">
              <Select id="rule-source" fullWidth name="source" value={form.source} onChange={handleChange}>
                <MenuItem value="employee">Сотрудник</MenuItem>
                <MenuItem value="system">Система</MenuItem>
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormField label="Кому" fullWidth htmlFor="rule-target">
              <Select id="rule-target" fullWidth name="target" value={form.target} onChange={handleChange}>
                <MenuItem value="employee">Сотрудник</MenuItem>
                <MenuItem value="department">Отдел</MenuItem>
              </Select>
            </FormField>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormField label="Значение (доля)" required fullWidth errorText={errors.value} htmlFor="rule-value">
              <TextField id="rule-value" fullWidth name="value" type="number" value={form.value} onChange={handleChange} />
            </FormField>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormField label="Активно" fullWidth htmlFor="rule-active">
              <FormControlLabel control={<Switch checked={!!form.active} onChange={handleToggle} />} label={form.active ? 'Да' : 'Нет'} />
            </FormField>
          </Grid>
        </Grid>
      </ModalBase>
    </Box>
  );
}