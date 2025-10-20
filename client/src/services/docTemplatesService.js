import http from './http';

export const docTemplatesService = {
  async list() {
    return http.get('/doc-templates').then(r => r.data);
  }
};