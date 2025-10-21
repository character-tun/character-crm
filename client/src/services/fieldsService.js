import http from './http';

// Field Schemas API client service
// Methods return response.data; errors are not caught and will propagate
export const fieldsService = {
  async list() {
    return http.get('/fields').then(r => r.data);
  },

  async get(id) {
    if (!id) throw new Error('fieldsService.get: id is required');
    return http.get(`/fields/${id}`).then(r => r.data);
  },

  async listVersions(scope, name) {
    if (!scope || !name) throw new Error('fieldsService.listVersions: scope and name are required');
    return http.get(`/fields/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/versions`).then(r => r.data);
  },

  async create(payload) {
    // { scope, name, fields, note }
    return http.post('/fields', payload).then(r => r.data);
  },

  async importSchema(payload) {
    // Alias for migrations/UI import: { scope, name, fields, note }
    return http.post('/fields/schemas', payload).then(r => r.data);
  },

  async patch(id, payload) {
    if (!id) throw new Error('fieldsService.patch: id is required');
    return http.patch(`/fields/${id}`, payload).then(r => r.data);
  },

  async activate(id) {
    if (!id) throw new Error('fieldsService.activate: id is required');
    return http.post(`/fields/${id}/activate`).then(r => r.data);
  },

  async deactivate(id) {
    if (!id) throw new Error('fieldsService.deactivate: id is required');
    return http.post(`/fields/${id}/deactivate`).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('fieldsService.remove: id is required');
    return http.delete(`/fields/${id}`).then(r => r.data);
  }
};