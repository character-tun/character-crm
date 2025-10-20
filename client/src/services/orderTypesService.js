import http from './http';

// OrderTypes API client service
// Methods return response.data; errors are not caught and will propagate
export const orderTypesService = {
  async list() {
    return http.get('/order-types').then(r => r.data);
  },

  async create(payload) {
    return http.post('/order-types', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('orderTypesService.update: id is required');
    return http.patch(`/order-types/${id}`, payload).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('orderTypesService.remove: id is required');
    return http.delete(`/order-types/${id}`).then(r => r.data);
  }
};