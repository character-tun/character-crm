import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import http from '../services/http';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export default function BootstrapFirstPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [checking, setChecking] = useState(true);
  const [usersExist, setUsersExist] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', confirm: '' });

  useEffect(() => {
    const check = async () => {
      setChecking(true);
      setError('');
      try {
        const { data } = await http.get('/auth/register-first');
        const exists = !!data?.usersExist;
        setUsersExist(exists);
        localStorage.setItem('first_user_allowed', exists ? '0' : '1');
      } catch (e) {
        const code = e?.response?.data?.error || '';
        const exists = code === 'USERS_ALREADY_EXIST';
        setUsersExist(exists);
        localStorage.setItem('first_user_allowed', exists ? '0' : '1');
      } finally {
        setChecking(false);
      }
    };
    check();
  }, []);

  const validate = () => {
    const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
    if (!emailRegex.test(form.email.trim())) return 'Неверный формат email';
    if (!form.name.trim()) return 'Имя обязательно';
    if ((form.password || '').length < 8) return 'Пароль должен быть не менее 8 символов';
    if (form.password !== form.confirm) return 'Пароль и подтверждение не совпадают';
    return '';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      const payload = { email: form.email.trim(), password: form.password, name: form.name.trim() };
      const { status, data } = await http.post('/auth/register-first', payload);
      if (status === 201 && data?.ok) {
        setSuccess(true);
        await login(form.email.trim(), form.password);
        navigate('/');
      } else {
        setError(data?.error || 'Не удалось создать администратора');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#fff', background: 'linear-gradient(#0008,#000b), url(https://images.pexels.com/photos/1402787/pexels-photo-1402787.jpeg?auto=compress&cs=tinysrgb&w=2400) center/cover fixed' }}>
        <div style={{ opacity: 0.9 }}>Проверка состояния системы...</div>
      </div>
    );
  }

  if (usersExist) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#fff',
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(https://images.pexels.com/photos/1402787/pexels-photo-1402787.jpeg?auto=compress&cs=tinysrgb&w=2400)',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', padding: 24
        }}
      >
        <div style={{ width: 520, maxWidth: '90vw', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <h2 style={{ marginTop: 0 }}>Первичная регистрация недоступна</h2>
          <p>Пользователи уже существуют в системе. Перейдите к экрану входа.</p>
          <button onClick={() => navigate('/login')} style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Перейти к входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#fff',
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(https://images.pexels.com/photos/1402787/pexels-photo-1402787.jpeg?auto=compress&cs=tinysrgb&w=2400)',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', padding: 24
      }}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 520, maxWidth: '90vw', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <h2 style={{ marginTop: 0 }}>Первичная регистрация администратора</h2>
        {error && <div style={{ color: '#ff6b6b' }}>Ошибка: {error}</div>}

        <label style={{ fontSize: 14, opacity: 0.85 }}>Email</label>
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', color: '#fff', outline: 'none' }} />

        <label style={{ fontSize: 14, opacity: 0.85 }}>Имя</label>
        <input type="text" placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', color: '#fff', outline: 'none' }} />

        <label style={{ fontSize: 14, opacity: 0.85 }}>Пароль</label>
        <input type="password" placeholder="Пароль (≥ 8 символов)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', color: '#fff', outline: 'none' }} />

        <label style={{ fontSize: 14, opacity: 0.85 }}>Подтверждение пароля</label>
        <input type="password" placeholder="Подтверждение" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', color: '#fff', outline: 'none' }} />

        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Создаём...' : 'Создать администратора'}
        </button>

        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
          Уже есть аккаунт? <a href="/login" style={{ color: '#fff', textDecoration: 'underline' }}>Перейти к входу</a>
        </div>
      </form>

      <Snackbar open={success} autoHideDuration={4000} onClose={() => setSuccess(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Администратор создан, выполнен вход
        </Alert>
      </Snackbar>
    </div>
  );
}