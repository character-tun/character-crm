import http from './http';

export const ordersService = {
  async getManyByIds(ids = []) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return {};
    try {
      const qs = encodeURIComponent(unique.join(','));
      const data = await http.get(`/detailing-orders/batch?ids=${qs}`).then(r => r.data);
      const map = {};
      (data || []).forEach((item) => {
        const id = item._id || item.id;
        if (id) map[id] = item;
      });
      return map;
    } catch (e) {
      // Fallback to individual requests on error
      const results = await Promise.all(unique.map(id => http.get(`/detailing-orders/${id}`).then(r=>r.data).catch(()=>null)));
      const map = {};
      unique.forEach((id, i) => {
        const item = results[i];
        if (item) map[id] = item;
      });
      return map;
    }
  },
  async getMany(ids = []) {
    return this.getManyByIds(ids);
  }
};