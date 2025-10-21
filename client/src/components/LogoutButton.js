import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';

export default function LogoutButton() {
  const navigate = useNavigate();

  const onClick = async () => {
    try {
      const refresh = localStorage.getItem('auth_refresh');
      if (refresh) {
        await logout(refresh);
      }
    } catch {}
    localStorage.removeItem('auth_access');
    localStorage.removeItem('auth_refresh');
    // Оставляем current_user, если нужен анонимный доступ. Иначе очищаем:
    localStorage.removeItem('current_user');
    navigate('/login');
  };

  return (
    <button onClick={onClick} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
      Выйти
    </button>
  );
}