import http from './http';

// Stocks API client service
// Использует расширенные эндпоинты /api/stock/balance и /api/stock/ledger
// Методы возвращают response.data; ошибки пробрасываются наверх
export const stocksService = {
  async balance(params = {}) {
    // Поддерживает { itemId?, locationId?, limit?, offset? }
    return http.get('/stock/balance', { params }).then(r => r.data);
  },

  async ledger(params = {}) {
    // Поддерживает { itemId?, locationId?, refType?, limit?, offset? }
    return http.get('/stock/ledger', { params }).then(r => r.data);
  },
};