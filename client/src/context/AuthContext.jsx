import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, refresh as apiRefresh, logout as apiLogout } from '../services/authService';
import { getAccess, setAccess, getUser, setUser, clearAuth, getRoles, hasAnyRole as storeHasAnyRole } from './authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [access, setAccessState] = useState(getAccess());
  const [user, setUserState] = useState(getUser());

  useEffect(() => {
    const refreshToken = localStorage.getItem('auth_refresh');
    const raw = localStorage.getItem('current_user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        setUserState(u);
      } catch {}
    }
    if (refreshToken && !getAccess()) {
      apiRefresh(refreshToken)
        .then(({ access }) => {
          setAccess(access);
          setAccessState(access);
        })
        .catch(() => {
          // keep unauthenticated
        });
    }
  }, []);

  const isAuthenticated = !!access;

  const login = async (email, password) => {
    const { access, refresh, user } = await apiLogin({ email, password });
    setAccess(access);
    setAccessState(access);
    setUser(user);
    setUserState(user);
    localStorage.setItem('auth_refresh', refresh);
    localStorage.setItem('current_user', JSON.stringify({ id: user.id, email: user.email, roles: user.roles, role: user.role }));
    return { access, refresh, user };
  };

  const refreshAccess = async () => {
    const refreshToken = localStorage.getItem('auth_refresh');
    if (!refreshToken) throw new Error('No refresh token');
    const { access } = await apiRefresh(refreshToken);
    setAccess(access);
    setAccessState(access);
    return access;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('auth_refresh');
      if (refreshToken) await apiLogout(refreshToken);
    } catch {}
    localStorage.removeItem('auth_refresh');
    localStorage.removeItem('current_user');
    clearAuth();
    setAccessState('');
    setUserState(null);
  };

  const value = useMemo(() => ({
    access,
    user,
    roles: getRoles(),
    isAuthenticated,
    login,
    logout,
    refreshAccess,
    hasAnyRole: (roles) => storeHasAnyRole(roles),
  }), [access, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};