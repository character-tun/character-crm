import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const STORAGE_KEY = 'settings_employees';
const DEFAULT_ROLES = ['Администратор', 'Менеджер', 'Мастер'];

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setEmployees(parsed);
      } catch {}
    }
  }, []);
  const roles = useMemo(() => {
    try {
      const saved = localStorage.getItem('settings_employee_roles');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ROLES;
    } catch {
      return DEFAULT_ROLES;
    }
  }, []);

  const columns = useMemo(() => ([
    { field: 'name', headerName: 'Имя', width: 180 },
    { field: 'role', headerName: 'Роль', width: 160 },
    { field: 'phone', headerName: 'Телефон', width: 160 },
    { field: 'email', headerName: 'Email', width: 200 },
  ]), []);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAdd = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Требуется имя';
    if (!form.role.trim()) newErrors.role = 'Выберите роль';
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (email && !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(email)) newErrors.email = 'Некорректный email';
    const digits = phone.replace(/\D/g, '');
    if (phone && digits.length < 10) newErrors.phone = 'Некорректный телефон';
    if (email && employees.some((e) => (e.email || '').toLowerCase() === email.toLowerCase())) newErrors.email = 'Email уже используется';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    const newItem = { id: Date.now().toString(), ...form };
    const updated = [...employees, newItem];
    setEmployees(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setForm({ name: '', role: '', phone: '', email: '' });
    setErrors({});
    handleClose();
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Сотрудники</Typography>
        <Button variant="contained" onClick={handleOpen}>Добавить сотрудника</Button>
      </Stack>

      <Paper sx={{ height: 420, p: 1, borderRadius: 2, border: '1px solid #2a2f37' }}>
        <DataGrid rows={employees} columns={columns} pageSize={5} rowsPerPageOptions={[5, 10]} />
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Добавить сотрудника</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Имя" name="name" value={form.name} onChange={handleChange} error={Boolean(errors.name)} helperText={errors.name || ''} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={Boolean(errors.role)}>
                <InputLabel id="role-label">Роль</InputLabel>
                <Select labelId="role-label" label="Роль" name="role" value={form.role} onChange={handleChange}>
                  {roles.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Телефон" name="phone" value={form.phone} onChange={handleChange} error={Boolean(errors.phone)} helperText={errors.phone || ''} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Email" name="email" value={form.email} onChange={handleChange} error={Boolean(errors.email)} helperText={errors.email || ''} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button variant="contained" onClick={handleAdd}>Добавить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;