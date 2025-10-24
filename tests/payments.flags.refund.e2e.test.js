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

describe('Payments feature flag: PAYMENTS_REFUND_ENABLED', () => {
  const originalEnv = { ...process.env };
  let app;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('refund disabled (PAYMENTS_REFUND_ENABLED=0) → 403', async () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.PAYMENTS_REFUND_ENABLED = '0';
    jest.resetModules();
    app = makeApp();

    const res = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Finance')
      .send({ orderId: 'flags-refund-1', amount: 10 });
    expect(res.statusCode).toBe(403);
    expect(String(res.body && res.body.error || '')).toMatch(/REFUND_DISABLED/);
  });

  test('refund enabled (PAYMENTS_REFUND_ENABLED=1) → 200', async () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.PAYMENTS_REFUND_ENABLED = '1';
    jest.resetModules();
    app = makeApp();

    const res = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Finance')
      .send({ orderId: 'flags-refund-2', amount: 10 });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(typeof res.body.id).toBe('string');
  });
});