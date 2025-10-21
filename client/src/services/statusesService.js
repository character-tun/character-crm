import http from './http';

export const getStatuses = () => {
  // Server enforces RBAC: require role 'settings.statuses:list'
  return http.get('/statuses', { headers: { 'x-user-role': 'settings.statuses:list' } });
};

export const updateStatus = (id, data) => {
  // Server enforces RBAC: require role 'settings.statuses:update'
  return http.put(`/statuses/${id}`, data, { headers: { 'x-user-role': 'settings.statuses:update' } });
};

export const reorderStatuses = (data) => {
  // Server enforces RBAC: require role 'settings.statuses:reorder'
  return http.patch('/statuses/reorder', data, { headers: { 'x-user-role': 'settings.statuses:reorder' } });
};