const request = require('supertest');
const express = require('express');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Payments feature flag: DEFAULT_CASH_REGISTER', () => {
  const originalEnv = { ...process.env };
  let app;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('auto-fill cashRegisterId in DEV when not provided', async () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.DEFAULT_CASH_REGISTER = 'dev-cash-xyz';
    jest.resetModules();
    app = makeApp();

    const orderId = 'flags-cash-1';
    const rCreate = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 10 });
    expect(rCreate.statusCode).toBe(200);
    expect(rCreate.body && rCreate.body.ok).toBe(true);

    const rList = await request(app)
      .get(`/api/payments?orderId=${orderId}`)
      .set('x-user-role', 'Finance');
    expect(rList.statusCode).toBe(200);
    const created = (rList.body.items || [])[0];
    expect(created).toBeTruthy();
    expect(String(created.cashRegisterId)).toBe('dev-cash-xyz');
  });
});
