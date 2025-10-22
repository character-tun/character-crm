import http from './http';

// Cash Registers API client service
// Methods return response.data; errors are not caught and will propagate
export const cashService = {
  async list(params = {}) {
    return http.get('/cash', { params }).then(r => r.data);
  },

  async create(payload) {
    // { code, name, defaultForLocation?, cashierMode?, isSystem? }
    return http.post('/cash', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('cashService.update: id is required');
    return http.patch(`/cash/${id}`, payload).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('cashService.remove: id is required');
    return http.delete(`/cash/${id}`).then(r => r.data);
  }
};