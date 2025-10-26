const request = require('supertest');
const express = require('express');

// Мокаем модель CashRegister, чтобы удалить кассу и получить ошибку CASH_IN_USE
jest.mock('../server/models/CashRegister', () => ({
  // Имитируем Mongoose Query: findById возвращает объект с методом lean()
  findById: jest.fn((id) => ({
    lean: () => Promise.resolve({ _id: id, code: 'cash-01' }),
  })),
  // deleteOne возвращает rejected Promise с нужным сообщением
  deleteOne: jest.fn(() => Promise.reject(new Error('CASH_REGISTER_HAS_PAYMENTS'))),
}));

describe('Cash delete guard e2e', () => {
  let app;
  beforeAll(() => {
    process.env.AUTH_DEV_MODE = '0'; // форсируем не-DEV ветку, чтобы сработала проверка кассы
    app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/cash', require('../routes/cash'));
    app.use(require('../middleware/error'));
  });

  test('DELETE /api/cash/:id → 409 CASH_IN_USE если есть платежи', async () => {
    const res = await request(app)
      .delete('/api/cash/mock-cash-id')
      .set('x-user-role', 'Admin'); // cash.write доступна для Admin

    expect(res.statusCode).toBe(409);
    expect(res.body && res.body.error).toBe('CASH_IN_USE');
  });
});
