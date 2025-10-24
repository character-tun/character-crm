import http from './http';

// Payments API client service
// Methods return response.data; errors are not caught and will propagate
export const paymentsService = {
  async list(params = {}) {
    return http.get('/payments', { params }).then(r => r.data);
  },

  async create(payload) {
    // Minimal required: { orderId } in DEV; more fields allowed server-side
    return http.post('/payments', payload).then(r => r.data);
  },

  async refund(payload) {
    // Minimal required: { orderId } in DEV; creates a refund payment
    return http.post('/payments/refund', payload).then(r => r.data);
  },

  async update(id, payload) {
    if (!id) throw new Error('paymentsService.update: id is required');
    return http.patch(`/payments/${id}`, payload).then(r => r.data);
  },

  async lock(id) {
    if (!id) throw new Error('paymentsService.lock: id is required');
    return http.post(`/payments/${id}/lock`).then(r => r.data);
  },

  async remove(id) {
    if (!id) throw new Error('paymentsService.remove: id is required');
    return http.delete(`/payments/${id}`).then(r => r.data);
  }
};