import http from './http';

// Payroll API client: rules and accruals
// Methods return response.data; errors propagate
export const payrollService = {
  // Rules
  async listRules(params = {}) {
    return http.get('/payroll/rules', { params }).then(r => r.data);
  },
  async createRule(payload) {
    return http.post('/payroll/rules', payload).then(r => r.data);
  },
  async updateRule(id, payload) {
    if (!id) throw new Error('payrollService.updateRule: id is required');
    return http.patch(`/payroll/rules/${id}`, payload).then(r => r.data);
  },
  async deleteRule(id) {
    if (!id) throw new Error('payrollService.deleteRule: id is required');
    return http.delete(`/payroll/rules/${id}`).then(r => r.data);
  },

  // Accruals
  async listAccruals(params = {}) {
    return http.get('/payroll/accruals', { params }).then(r => r.data);
  },
  async createAccrual(payload) {
    return http.post('/payroll/accruals', payload).then(r => r.data);
  }
};