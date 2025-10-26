import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, refresh as apiRefresh, logout as apiLogout } from '../services/authService';
import { getAccess, setAccess, getUser, setUser, clearAuth, getRoles, hasAnyRole as storeHasAnyRole } from './authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [access, setAccessState] = useState(getAccess());
  const [user, setUserState] = useState(getUser());

  useEffect(() => {
    // DEV bypass: allow app without login during testing
    const devBypass = (() => {
      try {
        const flag = localStorage.getItem('auth_dev_mode');
        if (flag === '1' || flag === 'true') return true;
      } catch {}
      return process.env.NODE_ENV !== 'production';
    })();

    if (devBypass) {
      const existingRaw = (() => {
        try { return localStorage.getItem('current_user') || ''; } catch { return ''; }
      })();
      let devUser = null;
      if (existingRaw) {
        try { devUser = JSON.parse(existingRaw); } catch {}
      }
      if (!devUser) {
        devUser = { id: 'dev', email: 'dev@localhost', roles: ['Admin'], role: 'Admin', name: 'Dev User' };
        try { localStorage.setItem('current_user', JSON.stringify(devUser)); } catch {}
      }
      setUser(devUser);
      setUserState(devUser);
      setAccess('DEV');
      setAccessState('DEV');
      return;
    }

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
        .then(({ accessToken, access }) => {
          const token = accessToken || access;
          setAccess(token);
          setAccessState(token);
        })
        .catch(() => {
          // keep unauthenticated
        });
    }
  }, []);

  const isAuthenticated = !!access;

  const login = async (email, password) => {
    const { accessToken, access, refreshToken, refresh, user } = await apiLogin({ email, password });
    const token = accessToken || access;
    const ref = refreshToken || refresh;
    setAccess(token);
    setAccessState(token);
    setUser(user);
    setUserState(user);
    localStorage.setItem('auth_refresh', ref);
    localStorage.setItem('current_user', JSON.stringify({ id: user.id, email: user.email, roles: user.roles, role: user.role }));
    return { access: token, refresh: ref, user };
  };

  const refreshAccess = async () => {
    const refreshToken = localStorage.getItem('auth_refresh');
    if (!refreshToken) throw new Error('No refresh token');
    const { accessToken, access } = await apiRefresh(refreshToken);
    const token = accessToken || access;
    setAccess(token);
    setAccessState(token);
    return token;
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
  }), [access, user, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};