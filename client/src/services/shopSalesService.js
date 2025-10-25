import http from './http';

const base = '/api/shop/sales';

const list = async (params = {}) => {
  const response = await http.get(base, { params });
  return response.data;
};

const get = async (id) => {
  const response = await http.get(`${base}/${id}`);
  return response.data;
};

const create = async ({ items = [], locationId, method = 'cash', cashRegisterId, note } = {}) => {
  const payload = { items, locationId, method, cashRegisterId, note };
  const response = await http.post(base, payload);
  return response.data;
};

const refund = async (id, { amount, reason } = {}) => {
  const response = await http.post(`${base}/${id}/refund`, { amount, reason });
  return response.data;
};

const shopSalesService = {
  list,
  get,
  create,
  refund,
};

export default shopSalesService;