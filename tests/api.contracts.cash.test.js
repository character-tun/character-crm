const request = require('supertest');
const express = require('express');
const Joi = require('joi');

const {
  cashRegisterSchema,
  cashListResponseSchema,
  cashCreateRequestSchema,
  cashItemResponseSchema,
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
  app.use('/api/cash', require('../routes/cash'));
  const errorHandler = require('../middleware/error');
  app.use(errorHandler);
  return app;
}

describe('API Contracts: /api/cash', () => {
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

    test('GET /api/cash returns valid list shape', async () => {
      const res = await request(app)
        .get('/api/cash')
        .set('x-user-role', 'Finance')
        .expect(200);
      joiOk(cashListResponseSchema, res.body);
    });

    test('POST /api/cash (create) returns valid item shape', async () => {
      const payload = { code: 'main', name: 'Главная касса', defaultForLocation: true, cashierMode: 'open' };
      joiOk(cashCreateRequestSchema, payload);
      const res = await request(app)
        .post('/api/cash')
        .set('x-user-role', 'Admin')
        .send(payload)
        .expect(201);
      joiOk(cashItemResponseSchema, res.body);
    });

    test('PATCH /api/cash/:id returns valid item shape', async () => {
      const created = await request(app)
        .post('/api/cash')
        .set('x-user-role', 'Admin')
        .send({ code: 'patchme', name: 'Касса для патча' })
        .expect(201);
      const id = created.body.item && created.body.item._id;
      const res = await request(app)
        .patch(`/api/cash/${id}`)
        .set('x-user-role', 'Admin')
        .send({ name: 'Обновлено' })
        .expect(200);
      joiOk(cashItemResponseSchema, res.body);
    });

    test('POST /api/cash validates required fields', async () => {
      const res = await request(app)
        .post('/api/cash')
        .set('x-user-role', 'Admin')
        .send({ name: 'Без кода' })
        .expect(400);
      expect(res.body && res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Mongo branch (mocked model)', () => {
    let app;
    beforeEach(() => {
      jest.resetModules();
      process.env.AUTH_DEV_MODE = '0';

      // Лёгкая in-memory реализация CashRegister для контракта
      const mem = { items: [] };
      jest.doMock('../server/models/CashRegister', () => {
        const { Types } = require('mongoose');
        return {
          async create(doc) {
            const _id = new Types.ObjectId();
            const item = { _id, ...doc };
            mem.items.push(item);
            return { _id };
          },
          findById(id) {
            const found = mem.items.find((i) => String(i._id) === String(id));
            return { lean: () => found || null };
          },
          find() {
            const chain = {
              sort() { return chain; },
              skip() { return chain; },
              limit() { return chain; },
              lean: async () => mem.items.slice(),
            };
            return chain;
          },
          findByIdAndUpdate(id, { $set }) {
            const idx = mem.items.findIndex((i) => String(i._id) === String(id));
            if (idx === -1) return { lean: () => null };
            mem.items[idx] = { ...mem.items[idx], ...$set };
            return { lean: () => mem.items[idx] };
          },
          deleteOne() { return Promise.resolve(); },
        };
      });

      app = makeApp();
    });

    test('POST /api/cash returns valid item shape (mocked model)', async () => {
      const payload = { code: 'mongo1', name: 'Касса M1' };
      joiOk(cashCreateRequestSchema, payload);
      const res = await request(app)
        .post('/api/cash')
        .set('x-user-role', 'Admin')
        .send(payload)
        .expect(201);
      joiOk(cashItemResponseSchema, res.body);
    });

    test('GET /api/cash returns valid list shape (mocked model)', async () => {
      const res = await request(app)
        .get('/api/cash')
        .set('x-user-role', 'Finance')
        .expect(200);
      joiOk(cashListResponseSchema, res.body);
    });
  });
});