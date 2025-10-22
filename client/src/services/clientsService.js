import http from './http';

// Clients API client service
// Methods return response.data; errors are not caught and will propagate
export const clientsService = {
  async list(params = {}) {
    // Optional search: pass { q: 'query' }
    return http.get('/clients', { params }).then(r => r.data);
  },

  async get(id) {
    if (!id) throw new Error('clientsService.get: id is required');
    return http.get(`/clients/${id}`).then(r => r.data);
  },

  async create(payload) {
    return http.post('/clients', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('clientsService.update: id is required');
    return http.put(`/clients/${id}`, payload).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('clientsService.remove: id is required');
    return http.delete(`/clients/${id}`).then(r => r.data);
  },
};