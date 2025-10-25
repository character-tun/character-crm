import http from './http';

export const reportsService = {
  async cashflow(params = {}) {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    if (params.locationId) query.set('locationId', params.locationId);
    const { data } = await http.get(`/reports/cashflow?${query.toString()}`);
    return data;
  },
  async stockTurnover(params = {}) {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    if (params.locationId) query.set('locationId', params.locationId);
    const { data } = await http.get(`/reports/stock-turnover?${query.toString()}`);
    return data;
  },
  async payrollSummary(params = {}) {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    const { data } = await http.get(`/reports/payroll-summary?${query.toString()}`);
    return data;
  },
};