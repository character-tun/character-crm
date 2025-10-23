import React, { useEffect, useMemo, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../services/usersService';
import { listRoles } from '../../services/rolesService';
import SettingsBackBar from '../../components/SettingsBackBar';
import {
  Box,
  Paper,
  Stack,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Checkbox,
} from '@mui/material';
import DataGridBase from '../../components/DataGridBase';

export default function UsersSettingsPage() {
  const [users, setUsers] = useState([]);
  const [rolesOptions, setRolesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({ email: '', full_name: '', is_active: true });

  const load = async () => {
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersData || []);
      setRolesOptions((rolesData || []).map(r => ({ id: r._id, code: r.code, name: r.name })));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Не удалось загрузить пользователей/роли');
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { email: newUser.email.trim(), full_name: newUser.full_name.trim(), is_active: !!newUser.is_active };
      const created = await createUser(payload);
      setUsers([created, ...users]);
      setNewUser({ email: '', full_name: '', is_active: true });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = async (id, changes) => {
    setError('');
    try {
      const updated = await updateUser(id, changes);
      setUsers(users.map(u => (u._id === id ? updated : u)));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Удалить пользователя?')) return;
    setError('');
    try {
      await deleteUser(id);
      setUsers(users.filter(u => u._id !== id));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const toggleUserRole = (userId, roleCode, checked) => {
    setUsers(users.map(u => {
      if (u._id !== userId) return u;
      const cur = Array.isArray(u.roles) ? u.roles : [];
      const nextRoles = checked ? Array.from(new Set([...cur, roleCode])) : cur.filter(rc => rc !== roleCode);
      return { ...u, roles: nextRoles };
    }));
  };

  const saveAll = async () => {
    setError('');
    try {
      await Promise.all(users.map(u => updateUser(u._id, {
        full_name: u.full_name,
        is_active: !!u.is_active,
        roles: Array.isArray(u.roles) ? u.roles : []
      })));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const columns = useMemo(() => [
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    {
      field: 'full_name',
      headerName: 'Имя',
      flex: 1,
      minWidth: 220,
      renderCell: (params) => (
        <TextField
          size="small"
          value={params.row.full_name || ''}
          onChange={(e) => setUsers(prev => prev.map(x => x._id === params.row._id ? { ...x, full_name: e.target.value } : x))}
          sx={{ width: '100%' }}
        />
      ),
    },
    {
      field: 'is_active',
      headerName: 'Статус',
      width: 200,
      renderCell: (params) => (
        <FormControlLabel
          control={
            <Switch
              checked={!!params.row.is_active}
              onChange={(e) => setUsers(prev => prev.map(x => x._id === params.row._id ? { ...x, is_active: e.target.checked } : x))}
            />
          }
          label={params.row.is_active ? 'Активен' : 'Отключён'}
        />
      ),
    },
    {
      field: 'roles',
      headerName: 'Роли',
      flex: 1.5,
      minWidth: 360,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {rolesOptions.map((r) => (
            <FormControlLabel
              key={r.id}
              control={
                <Checkbox
                  checked={Array.isArray(params.row.roles) && params.row.roles.includes(r.code)}
                  onChange={(e) => toggleUserRole(params.row._id, r.code, e.target.checked)}
                />
              }
              label={r.code}
            />
          ))}
        </Stack>
      ),
    },
    {
      field: 'actions',
      headerName: 'Действия',
      sortable: false,
      width: 220,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => onUpdate(params.row._id, { full_name: params.row.full_name, is_active: !!params.row.is_active, roles: Array.isArray(params.row.roles) ? params.row.roles : [] })}>Сохранить</Button>
          <Button size="small" color="error" onClick={() => onDelete(params.row._id)}>Удалить</Button>
        </Stack>
      ),
    },
  ], [rolesOptions]);

  return (
    <Box sx={{ p: 2 }}>
      <SettingsBackBar title="Настройки · Пользователи" onSave={saveAll} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>Ошибка: {error}</Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }} component="form" onSubmit={onCreate}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField label="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required sx={{ minWidth: 240 }} />
          <TextField label="Полное имя" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} sx={{ minWidth: 240 }} />
          <FormControlLabel control={<Switch checked={newUser.is_active} onChange={e => setNewUser({ ...newUser, is_active: e.target.checked })} />} label="Активен" />
          <Button type="submit" variant="contained" disabled={loading}>Создать</Button>
        </Stack>
      </Paper>

      <Paper>
        <DataGridBase
          autoHeight
          rows={users}
          columns={columns}
          getRowId={(row) => row._id}
          checkboxSelection={false}
        />
      </Paper>
    </Box>
  );
}