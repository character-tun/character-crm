import http from './http';

export const getStatuses = () => {
  return http.get('/statuses');
};

export const updateStatus = (id, data) => {
  return http.put(`/statuses/${id}`, data);
};

export const reorderStatuses = (data) => {
  return http.patch('/statuses/reorder', data);
};