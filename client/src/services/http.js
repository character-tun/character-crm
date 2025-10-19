import axios from 'axios';
import { getAccess, setAccess } from '../context/authStore';

const baseURL = process.env.REACT_APP_API_URL || '/api';

const http = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

http.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('current_user');
    if (raw) {
      const u = JSON.parse(raw);
      const id = u.login || u.id || '';
      const role = u.role || (Array.isArray(u.roles) ? u.roles[0] : 'manager');
      const name = u.name || u.login || id;
      config.headers['x-user-id'] = id;
      config.headers['x-user-role'] = role;
      config.headers['x-user-name'] = name;
    }
    const access = getAccess();
    if (access) {
      config.headers['Authorization'] = `Bearer ${access}`;
    }
  } catch {}
  return config;
}, (error) => Promise.reject(error));

http.interceptors.response.use((response) => response, async (error) => {
  const status = error?.response?.status;
  const originalRequest = error?.config || {};
  if (status === 401 && !originalRequest.__isRetry) {
    try {
      const refresh = localStorage.getItem('auth_refresh');
      if (refresh) {
        const { data } = await http.post('/auth/refresh', { refresh });
        if (data?.access) {
          setAccess(data.access);
          originalRequest.__isRetry = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
          return http(originalRequest);
        }
      }
    } catch (e) {
      // ignore
    }
  }
  const message = error?.response?.data?.error || error?.response?.data?.msg || error.message || 'Ошибка запроса';
  console.error('[HTTP ERROR]', message);
  return Promise.reject(error);
});

export default http;