import React, { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../services/usersService';
import { listRoles } from '../../services/rolesService';

export default function UsersSettingsPage() {
  const [users, setUsers] = useState([]);
  const [rolesOptions, setRolesOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({ email: '', full_name: '', is_active: true });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersData || []);
      setRolesOptions((rolesData || []).map(r => ({ id: r._id, code: r.code, name: r.name })));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Не удалось загрузить пользователей/роли');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { email: newUser.email.trim(), full_name: newUser.full_name.trim(), is_active: !!newUser.is_active };
      const created = await createUser(payload);
      setUsers([created, ...users]);
      setNewUser({ email: '', full_name: '', is_active: true });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
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

  return (
    <div style={{ padding: 16 }}>
      <h2>Настройки · Пользователи</h2>
      {error && <div style={{ color: '#ff6b6b', marginBottom: 12 }}>Ошибка: {error}</div>}
      <form onSubmit={onCreate} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          placeholder="Email"
          value={newUser.email}
          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
          required
        />
        <input
          placeholder="Полное имя"
          value={newUser.full_name}
          onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={newUser.is_active}
            onChange={e => setNewUser({ ...newUser, is_active: e.target.checked })}
          />
          Активен
        </label>
        <button type="submit" disabled={loading}>Создать</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Имя</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Статус</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Роли</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id}>
              <td style={{ padding: 8 }}>{u.email}</td>
              <td style={{ padding: 8 }}>
                <input
                  value={u.full_name || ''}
                  onChange={e => setUsers(users.map(x => x._id === u._id ? { ...x, full_name: e.target.value } : x))}
                />
              </td>
              <td style={{ padding: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!u.is_active}
                    onChange={e => setUsers(users.map(x => x._id === u._id ? { ...x, is_active: e.target.checked } : x))}
                  />
                  {u.is_active ? 'Активен' : 'Отключён'}
                </label>
              </td>
              <td style={{ padding: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rolesOptions.map((r) => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(u.roles) && u.roles.includes(r.code)}
                        onChange={(e) => toggleUserRole(u._id, r.code, e.target.checked)}
                      />
                      {r.code}
                    </label>
                  ))}
                </div>
              </td>
              <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => onUpdate(u._id, { full_name: u.full_name, is_active: u.is_active, roles: Array.isArray(u.roles) ? u.roles : [] })}>Сохранить</button>
                <button onClick={() => onDelete(u._id)} style={{ color: '#ff6b6b' }}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}