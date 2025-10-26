const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.AUTH_DEV_MODE = '1';

// Mock models to avoid mongoose compilation during route import
jest.mock('../models/OrderStatusLog', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/Order', () => ({
  findById: jest.fn(),
}));

// Service branch mocks
// Remove module-level mongoose mock; control readyState within tests
jest.mock('../services/orderStatusService', () => ({
  changeOrderStatus: jest.fn(),
}));

const { changeOrderStatus } = require('../services/orderStatusService');
const {
  changeStatusResponseDevSchema,
  orderStatusLogsResponseSchema,
} = require('../contracts/apiContracts');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/orders', require('../routes/orders'));
  app.use(require('../middleware/error'));
  return app;
}

const joiOk = (schema, payload) => {
  const { error } = schema.validate(payload, { allowUnknown: true });
  if (error) throw new Error(`Joi validation failed: ${error.message}`);
};

const httpError = (code, msg) => { const e = new Error(msg); e.statusCode = code; return e; };

// Helper to craft JWT with multiple roles
const makeToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret');

describe('API /api/orders contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /api/orders/:id/status (service branch via mongoose ready)', () => {
    beforeEach(() => {
      const mongoose = require('mongoose');
      mongoose.connection.readyState = 1;
    });

    test('returns 200 ok from service branch', async () => {
      changeOrderStatus.mockResolvedValue({ ok: true });
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-1/status')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'in_work', userId: 'u1' });
      expect(res.status).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('returns 404 when order not found (service branch)', async () => {
      changeOrderStatus.mockRejectedValue(httpError(404, 'Order not found'));
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-missing/status')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'in_work', userId: 'u1' });
      expect(res.status).toBe(404);
      expect(res.body && res.body.error).toBe('Order not found');
    });
  });

  describe('PATCH /api/orders/:id/status (DEV branch)', () => {
    // For DEV branch, temporarily override mongoose readyState to 0
    beforeEach(() => {
      const mongoose = require('mongoose');
      mongoose.connection.readyState = 0;
    });

    test('returns 400 when newStatusCode missing', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-2/status')
        .set('x-user-id', 'u2')
        .set('x-user-role', 'orders.changeStatus')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('newStatusCode is required');
    });

    test('returns 400 when userId missing', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-3/status')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'in_work' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('userId is required');
    });

    test('returns 403 REOPEN_FORBIDDEN without orders.reopen', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-4/status')
        .set('x-user-id', 'u4')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'in_work', from: 'closed_paid' });
      expect(res.status).toBe(403);
      expect(res.body && res.body.error).toBe('REOPEN_FORBIDDEN');
    });

    test('allows reopen with orders.reopen role', async () => {
      const app = makeApp();
      const token = makeToken({ id: 'u5', name: 'Tester', roles: ['orders.changeStatus', 'orders.reopen'] });
      const res = await request(app)
        .patch('/api/orders/ord-5/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ newStatusCode: 'in_work', from: 'closed_paid' });
      expect(res.status).toBe(200);
      joiOk(changeStatusResponseDevSchema, res.body);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('returns 403 without orders.changeStatus role', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/orders/ord-6/status')
        .set('x-user-id', 'u6')
        .send({ newStatusCode: 'in_work', userId: 'u6' });
      expect(res.status).toBe(403);
      expect(res.body && res.body.msg).toBe('Недостаточно прав');
    });
  });

  describe('GET /api/orders/:id/status-logs', () => {
    beforeEach(() => {
      const mongoose = require('mongoose');
      mongoose.connection.readyState = 0; // ensure DEV branch for logs
    });

    test('returns empty array when no logs', async () => {
      const app = makeApp();
      const res = await request(app)
        .get('/api/orders/ord-no/status-logs')
        .set('x-user-id', 'u7');
      expect(res.status).toBe(200);
      joiOk(orderStatusLogsResponseSchema, res.body);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    test('returns logs after status changes', async () => {
      const app = makeApp();
      // Change status to generate logs
      await request(app)
        .patch('/api/orders/ord-8/status')
        .set('x-user-id', 'u8')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'in_work', userId: 'u8' });
      await request(app)
        .patch('/api/orders/ord-8/status')
        .set('x-user-id', 'u8')
        .set('x-user-role', 'orders.changeStatus')
        .send({ newStatusCode: 'closed_paid', from: 'in_work', userId: 'u8' });

      const res = await request(app)
        .get('/api/orders/ord-8/status-logs')
        .set('x-user-id', 'u8');
      expect(res.status).toBe(200);
      joiOk(orderStatusLogsResponseSchema, res.body);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      // Ensure sorted desc by createdAt
      const ts = res.body.map((l) => new Date(l.createdAt).getTime());
      for (let i = 1; i < ts.length; i += 1) {
        expect(ts[i - 1]).toBeGreaterThanOrEqual(ts[i]);
      }
    });
  });
});
