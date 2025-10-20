import React, { useEffect, useState } from 'react';
import { listRoles, createRole, updateRole, deleteRole } from '../../services/rolesService';
import SettingsBackBar from '../../components/SettingsBackBar';
import {
  Box,
  Stack,
  TextField,
  Button,
  Alert,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

const DEFAULT_ROLES = [
  { code: 'Admin', name: 'Администратор' },
  { code: 'Manager', name: 'Менеджер' },
  { code: 'Production', name: 'Производство' },
  { code: 'Detailing', name: 'Детейлинг' },
  { code: 'Finance', name: 'Финансы' },
];

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState({ code: '', name: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRoles();
      setRoles(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Не удалось загрузить роли');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const code = newRole.code.trim();
      const name = newRole.name.trim();
      if (!code || !name) return;
      const exists = roles.some(r => (r.code || '').toLowerCase() === code.toLowerCase());
      if (exists) {
        setError('Роль с таким кодом уже существует');
        return;
      }
      const created = await createRole({ code, name });
      setRoles([created, ...roles]);
      setNewRole({ code: '', name: '' });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const onUpdate = async (id, changes) => {
    setError('');
    try {
      const updated = await updateRole(id, changes);
      setRoles(roles.map(r => (r._id === id ? updated : r)));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Удалить роль?')) return;
    setError('');
    try {
      await deleteRole(id);
      setRoles(roles.filter(r => r._id !== id));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const saveAll = async () => {
    setError('');
    try {
      await Promise.all(roles.map(r => updateRole(r._id, { name: r.name })));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const seedDefaults = async () => {
    setLoading(true);
    setError('');
    try {
      const existingCodes = new Set(roles.map(r => (r.code || '').toLowerCase()));
      const toCreate = DEFAULT_ROLES.filter(dr => !existingCodes.has(dr.code.toLowerCase()));
      if (!toCreate.length) {
        setError('Базовые роли уже созданы');
        return;
      }
      const createdList = [];
      for (const payload of toCreate) {
        try {
          const created = await createRole(payload);
          createdList.push(created);
        } catch (e) {
          setError(e?.response?.data?.error || e.message);
        }
      }
      if (createdList.length) setRoles([...createdList.reverse(), ...roles]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <SettingsBackBar title="Настройки · Роли" onSave={saveAll} />

      <Stack spacing={2} sx={{ mt: 2 }}>
        {!!error && <Alert severity="error">{error}</Alert>}

        <Typography variant="body2" color="text.secondary">
          Роли определяют доступы пользователей. Если список пуст, создайте базовые роли ниже.
        </Typography>

        {!roles.length && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" startIcon={<AddRoundedIcon />} onClick={seedDefaults} disabled={loading}>
              Создать базовые роли
            </Button>
          </Stack>
        )}

        <Box component="form" onSubmit={onCreate}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              label="Код"
              placeholder="Admin / Manager / Production / Detailing / Finance"
              value={newRole.code}
              onChange={e => setNewRole({ ...newRole, code: e.target.value })}
              required
              sx={{ minWidth: 260 }}
            />
            <TextField
              size="small"
              label="Название"
              value={newRole.name}
              onChange={e => setNewRole({ ...newRole, name: e.target.value })}
              required
              sx={{ minWidth: 200 }}
            />
            <Button type="submit" variant="contained" disabled={loading}>Создать</Button>
          </Stack>
        </Box>

        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 220 }}>Код</TableCell>
              <TableCell>Название</TableCell>
              <TableCell sx={{ width: 160 }}>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r._id} hover>
                <TableCell>{r.code}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={r.name || ''}
                    onChange={(e) => setRoles(roles.map(x => x._id === r._id ? { ...x, name: e.target.value } : x))}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Сохранить">
                      <span>
                        <IconButton color="primary" onClick={() => onUpdate(r._id, { name: r.name })} disabled={loading}>
                          <SaveOutlinedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Удалить">
                      <span>
                        <IconButton color="error" onClick={() => onDelete(r._id)} disabled={loading}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </Box>
  );
}