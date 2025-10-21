import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user } = await login(form.email.trim(), form.password);
      const from = location.state?.from?.pathname || '/';
      navigate(from);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(https://images.pexels.com/photos/1402787/pexels-photo-1402787.jpeg?auto=compress&cs=tinysrgb&w=2400)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        color: '#fff',
        padding: 24
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          width: 380,
          maxWidth: '90vw',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#fff'
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 600 }}>Вход в CRM Character</h2>
        {error && <div style={{ color: '#ff6b6b' }}>Ошибка: {error}</div>}

        <label style={{ fontSize: 14, opacity: 0.85 }}>Email</label>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          required
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            outline: 'none'
          }}
        />

        <label style={{ fontSize: 14, opacity: 0.85 }}>Пароль</label>
        <input
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            outline: 'none'
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}