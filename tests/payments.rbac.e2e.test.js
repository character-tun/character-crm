const request = require('supertest');
const express = require('express');

/**
 * RBAC e2e для /api/payments: GET/POST/PATCH/lock/refund
 * Роли: без прав, Manager, Finance, Admin
 * DEV_MODE=1 для in-memory ветки без Mongo
 */

describe('Payments RBAC e2e', () => {
  let app;
  beforeAll(() => {
    process.env.AUTH_DEV_MODE = '1';
    app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/payments', require('../routes/payments'));
    app.use(require('../middleware/error'));
  });

  describe('GET /api/payments', () => {
    test('without role → 403', async () => {
      const res = await request(app).get('/api/payments');
      expect(res.statusCode).toBe(403);
    });

    test('Manager → 200', async () => {
      const res = await request(app).get('/api/payments').set('x-user-role', 'Manager');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('Finance → 200', async () => {
      const res = await request(app).get('/api/payments').set('x-user-role', 'Finance');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body).toHaveProperty('totals');
    });

    test('Admin → 200', async () => {
      const res = await request(app).get('/api/payments').set('x-user-role', 'Admin');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('POST /api/payments (create)', () => {
    const payload = { orderId: 'rbac-order-1' };

    test('without role → 403', async () => {
      const res = await request(app).post('/api/payments').send(payload);
      expect(res.statusCode).toBe(403);
    });

    test('Manager → 403', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Manager')
        .send(payload);
      expect(res.statusCode).toBe(403);
    });

    test('Finance → 200', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send(payload);
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(typeof res.body.id).toBe('string');
    });

    test('Admin → 200', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Admin')
        .send({ orderId: 'rbac-order-2' });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('PATCH /api/payments/:id', () => {
    let createdId;
    beforeAll(async () => {
      const created = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'rbac-order-3' });
      createdId = created.body.id;
    });

    test('without role → 403', async () => {
      const res = await request(app)
        .patch(`/api/payments/${createdId}`)
        .send({ note: 'edit without role' });
      expect(res.statusCode).toBe(403);
    });

    test('Manager → 403', async () => {
      const res = await request(app)
        .patch(`/api/payments/${createdId}`)
        .set('x-user-role', 'Manager')
        .send({ note: 'edit by manager' });
      expect(res.statusCode).toBe(403);
    });

    test('Finance → 200', async () => {
      const res = await request(app)
        .patch(`/api/payments/${createdId}`)
        .set('x-user-role', 'Finance')
        .send({ note: 'edit by finance' });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(res.body.item && res.body.item.note).toBe('edit by finance');
    });

    test('Admin → 200', async () => {
      const res = await request(app)
        .patch(`/api/payments/${createdId}`)
        .set('x-user-role', 'Admin')
        .send({ note: 'edit by admin' });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(res.body.item && res.body.item.note).toBe('edit by admin');
    });
  });

  describe('POST /api/payments/:id/lock', () => {
    let createdId;
    beforeAll(async () => {
      const created = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'rbac-order-4' });
      createdId = created.body.id;
    });

    test('without role → 403', async () => {
      const res = await request(app).post(`/api/payments/${createdId}/lock`);
      expect(res.statusCode).toBe(403);
    });

    test('Manager → 403', async () => {
      const res = await request(app)
        .post(`/api/payments/${createdId}/lock`)
        .set('x-user-role', 'Manager');
      expect(res.statusCode).toBe(403);
    });

    test('Finance → 200', async () => {
      const res = await request(app)
        .post(`/api/payments/${createdId}/lock`)
        .set('x-user-role', 'Finance');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(res.body.item && res.body.item.locked).toBe(true);
    });

    test('Admin → 200', async () => {
      const created = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'rbac-order-5' });
      const anotherId = created.body.id;
      const res = await request(app)
        .post(`/api/payments/${anotherId}/lock`)
        .set('x-user-role', 'Admin');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('POST /api/payments/refund', () => {
    const payload = { orderId: 'rbac-order-6' };

    test('without role → 403', async () => {
      const res = await request(app).post('/api/payments/refund').send(payload);
      expect(res.statusCode).toBe(403);
    });

    test('Manager → 403', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('x-user-role', 'Manager')
        .send(payload);
      expect(res.statusCode).toBe(403);
    });

    test('Finance → 200', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('x-user-role', 'Finance')
        .send(payload);
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('Admin → 200', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('x-user-role', 'Admin')
        .send({ orderId: 'rbac-order-7' });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });
});