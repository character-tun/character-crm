import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Grid } from '@mui/material';

const STORAGE_KEY = 'settings_company';

const Company = () => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    requisites: '',
    country: 'Россия',
    currency: 'RUB',
    email: '',
    website: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm({ ...form, ...parsed });
      } catch {}
    }
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  };

  const handleReset = () => {
    const initial = {
      name: '', phone: '', address: '', requisites: '', country: 'Россия', currency: 'RUB', email: '', website: ''
    };
    setForm(initial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 800 }}>Компания</Typography>
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #2a2f37' }}>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Название" name="name" value={form.name} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Телефон" name="phone" value={form.phone} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Email" name="email" value={form.email} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Веб-сайт" name="website" value={form.website} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Адрес" name="address" value={form.address} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Реквизиты (ИНН, КПП, ОГРН)" name="requisites" value={form.requisites} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Страна" name="country" value={form.country} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Валюта" name="currency" value={form.currency} onChange={handleChange} />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSave}>Сохранить</Button>
            <Button variant="outlined" color="secondary" onClick={handleReset}>Сбросить</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Company;