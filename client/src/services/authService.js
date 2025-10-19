import http from './http';

export const login = async ({ email, password }) => {
  const { data } = await http.post('/auth/login', { email, password });
  return data; // { access, refresh, user }
};

export const refresh = async (refreshToken) => {
  const { data } = await http.post('/auth/refresh', { refresh: refreshToken });
  return data; // { access }
};

export const logout = async (refreshToken) => {
  const { data } = await http.post('/auth/logout', { refresh: refreshToken });
  return data; // { ok: true }
};