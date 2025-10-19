import React, { useEffect, useState } from 'react';
import { listRoles, createRole, updateRole, deleteRole } from '../../services/rolesService';

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
      const payload = { code: newRole.code.trim(), name: newRole.name.trim() };
      const created = await createRole(payload);
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

  return (
    <div style={{ padding: 16 }}>
      <h2>Настройки · Роли</h2>
      {error && <div style={{ color: '#ff6b6b', marginBottom: 12 }}>Ошибка: {error}</div>}
      <form onSubmit={onCreate} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          placeholder="Код (Admin/Manager/Production/Detailing/Finance)"
          value={newRole.code}
          onChange={e => setNewRole({ ...newRole, code: e.target.value })}
          required
        />
        <input
          placeholder="Название"
          value={newRole.name}
          onChange={e => setNewRole({ ...newRole, name: e.target.value })}
          required
        />
        <button type="submit" disabled={loading}>Создать</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Код</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Название</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r._id}>
              <td style={{ padding: 8 }}>{r.code}</td>
              <td style={{ padding: 8 }}>
                <input
                  value={r.name || ''}
                  onChange={e => setRoles(roles.map(x => x._id === r._id ? { ...x, name: e.target.value } : x))}
                />
              </td>
              <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => onUpdate(r._id, { name: r.name })}>Сохранить</button>
                <button onClick={() => onDelete(r._id)} style={{ color: '#ff6b6b' }}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}