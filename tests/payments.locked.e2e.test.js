const request = require('supertest');
const express = require('express');

// Ensure DEV mode so orders route uses in-memory branch when Mongo not connected
process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

// Helper to wait for mem queue to process auto-actions
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

describe('POST /api/payments — PAYMENTS_LOCKED after closeWithoutPayment (DEV)', () => {
  test('returns 400 when order closed without payment', async () => {
    const app = makeApp();
    const orderId = 'ord-e2e-lock-1';
    const userId = 'u-e2e-lock-1';

    // Step 1: new -> in_work
    let res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', from: 'new', userId });
    expect(res.status).toBe(200);

    // Step 2: in_work -> closed_unpaid (auto action closeWithoutPayment should run)
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'closed_unpaid', from: 'in_work', userId });
    expect(res.status).toBe(200);

    // Wait a tick for in-memory queue to process auto-actions
    await sleep(20);

    // Step 3: try to create payment → should be locked
    res = await request(app)
      .post('/api/payments')
      .set('x-user-id', userId)
      .send({ orderId });

    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('PAYMENTS_LOCKED');
  });
});