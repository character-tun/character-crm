import http from './http';

export const listRoles = async () => {
  const { data } = await http.get('/roles');
  return data;
};

export const getRole = async (id) => {
  const { data } = await http.get(`/roles/${id}`);
  return data;
};

export const createRole = async (payload) => {
  // payload: { code, name }
  const { data } = await http.post('/roles', payload);
  return data;
};

export const updateRole = async (id, payload) => {
  // payload: { name }
  const { data } = await http.put(`/roles/${id}`, payload);
  return data;
};

export const deleteRole = async (id) => {
  const { data } = await http.delete(`/roles/${id}`);
  return data;
};