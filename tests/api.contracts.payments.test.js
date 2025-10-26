const request = require('supertest');
const express = require('express');
const Joi = require('joi');

const {
  paymentCreateRequestSchema,
  paymentCreateResponseSchema,
} = require('../contracts/apiContracts');

function joiOk(schema, payload, { allowUnknown = true } = {}) {
  const { error } = schema.validate(payload, { allowUnknown });
  if (error) throw new Error(error.message);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  const { withUser } = require('../middleware/auth');
  app.use(withUser);
  app.use('/api/payments', require('../routes/payments'));
  const errorHandler = require('../middleware/error');
  app.use(errorHandler);
  return app;
}

describe('API Contracts: /api/payments', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  describe('DEV branch', () => {
    let app;
    beforeEach(() => {
      process.env.AUTH_DEV_MODE = '1';
      jest.resetModules();
      app = makeApp();
    });

    test('POST /api/payments (create) returns valid response', async () => {
      const payload = { orderId: 'dev-order-1', amount: 123.45, currency: 'USD' };
      joiOk(paymentCreateRequestSchema, payload);
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send(payload)
        .expect(200);
      joiOk(paymentCreateResponseSchema, res.body);
    });

    test('POST /api/payments/refund returns valid response', async () => {
      const payload = { orderId: 'dev-order-2', amount: 50, currency: 'USD' };
      joiOk(paymentCreateRequestSchema, payload);
      const res = await request(app)
        .post('/api/payments/refund')
        .set('x-user-role', 'Finance')
        .send(payload)
        .expect(200);
      joiOk(paymentCreateResponseSchema, res.body);
    });

    test('POST /api/payments validates required fields', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ amount: 10 })
        .expect(400);
      expect(res.body && res.body.error).toBeTruthy();
    });
  });

  describe('Mongo branch', () => {
    let app;

    beforeEach(() => {
      jest.resetModules();
      const mongoose = require('mongoose');
      // Ensure connection starts closed so model compilation doesn't crash
      try { mongoose.connection.readyState = 0; } catch {}

      let currentOrder = null;
      process.env.AUTH_DEV_MODE = '0';
      app = makeApp();

      // Now flip connection to 'ready' for route branch checks
      try { mongoose.connection.readyState = 1; } catch (e) {
        Object.defineProperty(mongoose, 'connection', { value: { readyState: 1 }, configurable: true });
      }

      const Order = require('../models/Order');
      Order.findById = jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(currentOrder) }));
      Order.__setOrder = (doc) => { currentOrder = doc; };
    });

    test('order not found returns 404', async () => {
      const Order = require('../models/Order');
      Order.__setOrder(null);
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Admin')
        .send({ orderId: 'missing', amount: 10, currency: 'USD' })
        .expect(404);
      expect(res.body && res.body.error).toBeTruthy();
    });

    test('create payment succeeds when order open and unlocked', async () => {
      const Order = require('../models/Order');
      Order.__setOrder({ _id: 'o1', paymentsLocked: false });
      const payload = { orderId: 'o1', amount: 99.99, currency: 'USD' };
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send(payload)
        .expect(200);
      joiOk(paymentCreateResponseSchema, res.body);
    });

    test('create payment blocked when paymentsLocked', async () => {
      const Order = require('../models/Order');
      Order.__setOrder({ _id: 'o2', paymentsLocked: true });
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'o2', amount: 10, currency: 'USD' })
        .expect(400);
      expect(res.body && res.body.error).toBe('PAYMENTS_LOCKED');
    });

    test('refund blocked when order closed', async () => {
      const Order = require('../models/Order');
      Order.__setOrder({ _id: 'o3', paymentsLocked: false, closed: { success: true } });
      const res = await request(app)
        .post('/api/payments/refund')
        .set('x-user-role', 'Admin')
        .send({ orderId: 'o3', amount: 10, currency: 'USD' })
        .expect(400);
      expect(res.body && res.body.error).toBe('ORDER_CLOSED');
    });

    test('RBAC requires Finance or Admin', async () => {
      const Order = require('../models/Order');
      Order.__setOrder({ _id: 'o4', paymentsLocked: false });
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'User')
        .send({ orderId: 'o4', amount: 10, currency: 'USD' })
        .expect(403);
      expect(res.body && (res.body.error || res.body.msg)).toBeTruthy();
    });
  });
});
