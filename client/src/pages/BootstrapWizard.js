import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import http from '../services/http';
import { createRole, listRoles } from '../services/rolesService';

export default function BootstrapWizard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@localhost');
  const [password, setPassword] = useState('admin');
  const [name, setName] = useState('Администратор');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const onSubmit = async () => {
    setError('');
    setResult(null);
    try {
      const { data } = await http.post('/auth/bootstrap-admin', { email, password, name });
      setResult(data);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка выполнения';
      setError(msg);
    }
  };

  const seedBaseRoles = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const existing = await listRoles();
      const have = new Set((existing || []).map(r => r.code));
      const needed = [
        { code: 'Manager', name: 'Менеджер' },
        { code: 'Production', name: 'Производство' },
        { code: 'Detailing', name: 'Детейлинг' },
        { code: 'Finance', name: 'Финансы' },
      ];
      let createdCount = 0;
      for (const r of needed) {
        if (!have.has(r.code)) {
          try { await createRole(r); createdCount++; } catch {}
        }
      }
      setSeedMsg(createdCount > 0 ? `Создано ролей: ${createdCount}` : 'Все базовые роли уже существуют');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка при создании ролей';
      setSeedMsg(msg);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Bootstrap администратора</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Заполните данные для первого администратора и запустите инициализацию. В DEV-режиме значения могут быть переопределены.
      </Typography>

      <Stack spacing={2} sx={{ mb: 2 }}>
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
        <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
        <TextField label="Полное имя" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={onSubmit}>Создать администратора</Button>
          <Button variant="outlined" onClick={() => navigate('/login')}>Перейти к входу</Button>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Администратор готов. Email: <strong>{result?.user?.email || email}</strong>. Роль: <strong>{(result?.user?.roles || ['Admin']).join(', ')}</strong>.
        </Alert>
      )}

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>Базовые роли</Typography>
      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        Необязательно: создайте базовые роли для теста RBAC (Manager, Production, Detailing, Finance).
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button variant="outlined" disabled={seeding} onClick={seedBaseRoles}>Создать роли</Button>
        {seedMsg && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{seedMsg}</Typography>}
      </Box>
    </Box>
  );
}