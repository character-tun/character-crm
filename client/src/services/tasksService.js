import http from './http';

export const tasksService = {
  async list(params = {}) {
    const { data } = await http.get('/tasks', { params });
    return data;
  },
  async get(id) {
    const { data } = await http.get(`/tasks/${id}`);
    return data;
  },
  async create(task) {
    const { data } = await http.post('/tasks', task);
    return data;
  },
  async update(id, patch) {
    const { data } = await http.put(`/tasks/${id}`, patch);
    return data;
  },
  async updatePosition(id, { status, order }) {
    const { data } = await http.patch(`/tasks/${id}/position`, { status, order });
    return data;
  },
  async remove(id) {
    const { data } = await http.delete(`/tasks/${id}`);
    return data;
  },
};