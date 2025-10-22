const request = require('supertest');
const express = require('express');
const Joi = require('joi');

const {
  stockItemSchema,
  stockItemsListResponseSchema,
  stockItemCreateRequestSchema,
  stockItemCreateResponseSchema,
  stockMovementSchema,
  stockMovementsListResponseSchema,
  stockMovementCreateRequestSchema,
  stockMovementItemResponseSchema,
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
  app.use('/api/stock', require('../routes/stock'));
  const errorHandler = require('../middleware/error');
  app.use(errorHandler);
  return app;
}

describe('API Contracts: Stock Items & Movements', () => {
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

    test('RBAC: Manager forbidden to read/write warehouse', async () => {
      await request(app)
        .get('/api/stock/items')
        .set('x-user-role', 'Manager')
        .set('x-user-id', 'u_mgr')
        .expect(403);

      await request(app)
        .post('/api/stock/movements')
        .set('x-user-role', 'Manager')
        .set('x-user-id', 'u_mgr')
        .send({ itemId: 'SKU-1', type: 'receipt', qty: 1 })
        .expect(403);
    });

    test('Items: list and create adhere to schema', async () => {
      const listRes0 = await request(app)
        .get('/api/stock/items')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .expect(200);
      joiOk(stockItemsListResponseSchema, listRes0.body);
      expect(Array.isArray(listRes0.body.items)).toBe(true);

      const createPayload = { itemId: 'SKU-ABC', qtyOnHand: 3, unit: 'pcs' };
      joiOk(stockItemCreateRequestSchema, createPayload);
      const createRes = await request(app)
        .post('/api/stock/items')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .send(createPayload)
        .expect(200);
      joiOk(stockItemCreateResponseSchema, createRes.body);

      const listRes = await request(app)
        .get('/api/stock/items')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .expect(200);
      joiOk(stockItemsListResponseSchema, listRes.body);
      const created = listRes.body.items.find((i) => i.itemId === 'SKU-ABC');
      joiOk(stockItemSchema, created);
      expect(created.qtyOnHand).toBeGreaterThanOrEqual(0);
    });

    test('Movements: receipt → issue → adjust adhere to schema and update balances', async () => {
      const itemId = 'SKU-FLOW';

      // Begin with a receipt of +10
      const receiptReq = { itemId, type: 'receipt', qty: 10, note: 'initial' };
      joiOk(stockMovementCreateRequestSchema, receiptReq);
      const recRes = await request(app)
        .post('/api/stock/movements')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .send(receiptReq)
        .expect(201);
      joiOk(stockMovementItemResponseSchema, recRes.body);
      const recItem = recRes.body.item;
      joiOk(stockMovementSchema, recItem);
      expect(recItem.type).toBe('receipt');
      expect(recItem.qty).toBe(10);

      // Issue -4
      const issueReq = { itemId, type: 'issue', qty: 4, note: 'usage' };
      joiOk(stockMovementCreateRequestSchema, issueReq);
      const issRes = await request(app)
        .post('/api/stock/movements')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .send(issueReq)
        .expect(201);
      joiOk(stockMovementItemResponseSchema, issRes.body);
      const issItem = issRes.body.item;
      expect(issItem.type).toBe('issue');
      expect(issItem.qty).toBe(-4); // signed value stored

      // Adjust -1 (e.g., shrinkage)
      const adjustReq = { itemId, type: 'adjust', qty: -1, note: 'counting correction' };
      joiOk(stockMovementCreateRequestSchema, adjustReq);
      const adjRes = await request(app)
        .post('/api/stock/movements')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .send(adjustReq)
        .expect(201);
      joiOk(stockMovementItemResponseSchema, adjRes.body);
      const adjItem = adjRes.body.item;
      expect(adjItem.type).toBe('adjust');
      expect(adjItem.qty).toBe(-1);

      // Verify movements list adheres to schema
      const movListRes = await request(app)
        .get('/api/stock/movements')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .expect(200);
      joiOk(stockMovementsListResponseSchema, movListRes.body);
      expect(movListRes.body.items.length).toBeGreaterThanOrEqual(3);

      // Check final balance: 0 + 10 - 4 - 1 = 5
      const itemsRes = await request(app)
        .get('/api/stock/items')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .expect(200);
      joiOk(stockItemsListResponseSchema, itemsRes.body);
      const sku = itemsRes.body.items.find((i) => i.itemId === itemId);
      joiOk(stockItemSchema, sku);
      expect(sku.qtyOnHand).toBe(5);
    });
  });
});