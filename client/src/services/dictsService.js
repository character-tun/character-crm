import http from './http';

// Dictionaries API client service
// Methods return response.data; errors are not caught and will propagate
export const dictsService = {
  async list() {
    return http.get('/dicts').then(r => r.data);
  },

  async get(id) {
    if (!id) throw new Error('dictsService.get: id is required');
    return http.get(`/dicts/${id}`).then(r => r.data);
  },

  async getByCode(code) {
    if (!code) throw new Error('dictsService.getByCode: code is required');
    return http.get(`/dicts/by-code/${encodeURIComponent(code)}`).then(r => r.data);
  },

  async create(payload) {
    // { code, values }
    return http.post('/dicts', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('dictsService.update: id is required');
    return http.patch(`/dicts/${id}`, payload).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('dictsService.remove: id is required');
    return http.delete(`/dicts/${id}`).then(r => r.data);
  }
};