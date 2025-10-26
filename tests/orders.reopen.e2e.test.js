const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Ensure DEV mode so orders route uses in-memory branch when Mongo not connected
process.env.AUTH_DEV_MODE = '1';
process.env.ENABLE_STATUS_QUEUE = '0';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/orders', require('../routes/orders'));
  app.use(require('../middleware/error'));
  return app;
}

function makeToken(user) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  return jwt.sign(user, secret);
}

describe('PATCH /api/orders/:id/status — reopen permission (DEV)', () => {
  beforeEach(() => {
    // Reset any global state if needed; memStatusLogs lives in route module scope
    // No explicit reset available; tests supply `from` explicitly for DEV branch
  });

  test('forbids reopen closed_paid → in_work without orders.reopen', async () => {
    const app = makeApp();
    const orderId = 'ord-e2e-1';
    const userId = 'u-e2e-1';

    // Step 1: new -> in_work
    let res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', from: 'new', userId });
    expect(res.status).toBe(200);

    // Step 2: in_work -> closed_paid
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'closed_paid', from: 'in_work', userId });
    expect(res.status).toBe(200);

    // Step 3: closed_paid -> in_work without reopen permission
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', from: 'closed_paid', userId });
    expect(res.status).toBe(403);
    expect(res.body && res.body.error).toBe('REOPEN_FORBIDDEN');
  });

  test('allows reopen closed_paid → in_work with orders.reopen', async () => {
    const app = makeApp();
    const orderId = 'ord-e2e-2';
    const userId = 'u-e2e-2';

    const token = makeToken({ id: userId, name: 'Tester', roles: ['orders.changeStatus', 'orders.reopen'] });

    // Step 1: new -> in_work
    let res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'in_work', from: 'new', userId });
    expect(res.status).toBe(200);

    // Step 2: in_work -> closed_paid
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'closed_paid', from: 'in_work', userId });
    expect(res.status).toBe(200);

    // Step 3: closed_paid -> in_work with reopen permission
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'in_work', from: 'closed_paid', userId });
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });
});
