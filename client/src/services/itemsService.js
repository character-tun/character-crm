import http from './http';

// Items (Catalog) API client service
// Methods return response.data; errors propagate to caller
export const itemsService = {
  async list(params = {}) {
    // Supports { q, limit, offset }
    return http.get('/items', { params }).then(r => r.data);
  },

  async create(payload) {
    // Minimal required: { name }; optional: price, unit, sku, tags, note
    return http.post('/items', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('itemsService.update: id is required');
    return http.patch(`/items/${id}`, payload).then(r => r.data);
  },
};