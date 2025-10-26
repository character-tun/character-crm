const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Payments flow e2e — income + refund + balance (DEV)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    const mongoose = require('mongoose');
    // Force DEV branch by marking mongo connection unusable
    mongoose.connection.readyState = 0;
    try { delete mongoose.connection.db; } catch (_) {}
  });

  test('Create income, create refund, verify balance totals', async () => {
    const app = makeApp();
    const orderId = 'ord_dev_1';

    // Income payment
    const p1 = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, type: 'income', amount: 100 });
    expect(p1.status).toBe(200);
    expect(p1.body && p1.body.ok).toBe(true);

    // Refund payment
    const r1 = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 30 });
    expect(r1.status).toBe(200);
    expect(r1.body && r1.body.ok).toBe(true);

    // List payments and check totals
    const list = await request(app)
      .get(`/api/payments?orderId=${orderId}`)
      .set('x-user-role', 'Finance');
    expect(list.status).toBe(200);
    expect(list.body && list.body.ok).toBe(true);
    expect(list.body.totals && list.body.totals.income).toBe(100);
    expect(list.body.totals && list.body.totals.refund).toBe(30);
    expect(list.body.totals && list.body.totals.balance).toBe(70);
  });
});