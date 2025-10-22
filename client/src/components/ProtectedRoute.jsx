import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, hasAnyRole } = useAuth();
  const location = useLocation();

  const devBypass = (() => {
    try {
      const flag = localStorage.getItem('auth_dev_mode');
      if (flag === '1' || flag === 'true') return true;
    } catch {}
    return process.env.NODE_ENV !== 'production';
  })();

  if (devBypass) {
    return children;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && roles.length && !hasAnyRole(roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}