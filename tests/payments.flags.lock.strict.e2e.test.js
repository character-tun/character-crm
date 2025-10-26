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

describe('Payments feature flag: CASH_LOCK_STRICT', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  describe('strict=0 (default rules)', () => {
    let app;
    let paymentId;
    beforeAll(async () => {
      process.env.AUTH_DEV_MODE = '1';
      process.env.CASH_LOCK_STRICT = '0';
      jest.resetModules();
      app = makeApp();
      const created = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'flags-lock-1' });
      paymentId = created.body.id;
      expect(typeof paymentId).toBe('string');
      const rLock = await request(app)
        .post(`/api/payments/${paymentId}/lock`)
        .set('x-user-role', 'Finance');
      expect(rLock.statusCode).toBe(200);
      expect(rLock.body && rLock.body.item && rLock.body.item.locked).toBe(true);
    });

    test('PATCH locked with payments.lock permission → 200', async () => {
      const res = await request(makeApp())
        .patch(`/api/payments/${paymentId}`)
        .set('x-user-role', 'Finance')
        .send({ note: 'edit under default rules' });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('strict=1 (forbid any PATCH for locked)', () => {
    let app;
    let paymentId;
    beforeAll(async () => {
      process.env.AUTH_DEV_MODE = '1';
      process.env.CASH_LOCK_STRICT = '1';
      jest.resetModules();
      app = makeApp();
      const created = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'flags-lock-2' });
      paymentId = created.body.id;
      expect(typeof paymentId).toBe('string');
      const rLock = await request(app)
        .post(`/api/payments/${paymentId}/lock`)
        .set('x-user-role', 'Finance');
      expect(rLock.statusCode).toBe(200);
      expect(rLock.body && rLock.body.item && rLock.body.item.locked).toBe(true);
    });

    test('PATCH locked even with payments.lock → 403', async () => {
      const res = await request(makeApp())
        .patch(`/api/payments/${paymentId}`)
        .set('x-user-role', 'Finance')
        .send({ note: 'edit under strict' });
      expect(res.statusCode).toBe(403);
      expect(String((res.body && res.body.error) || '')).toMatch(/PAYMENT_LOCKED/);
    });
  });
});