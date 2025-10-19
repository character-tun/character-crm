import http from './http';

export const listUsers = async () => {
  const { data } = await http.get('/users');
  return data;
};

export const getUser = async (id) => {
  const { data } = await http.get(`/users/${id}`);
  return data;
};

export const createUser = async (payload) => {
  // payload: { email, pass_hash?, full_name?, is_active? }
  const { data } = await http.post('/users', payload);
  return data;
};

export const updateUser = async (id, payload) => {
  // payload: { email?, full_name?, is_active? } (без pass_hash)
  const { data } = await http.put(`/users/${id}`, payload);
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await http.delete(`/users/${id}`);
  return data;
};