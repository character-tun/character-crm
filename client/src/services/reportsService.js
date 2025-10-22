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
};