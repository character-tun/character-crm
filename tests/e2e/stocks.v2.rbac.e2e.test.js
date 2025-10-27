const request = require('supertest');
const express = require('express');
const path = require('path');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/stocks', require('../../routes/stocks'));
  app.use(require('../../middleware/error'));
  return app;
}

function mockMongooseSession() {
  const mongoose = require('mongoose');
  if (!mongoose.connection) mongoose.connection = {};
  mongoose.connection.readyState = 1;
  mongoose.startSession = async () => ({
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    endSession() {},
  });
}

function installStockModelMocks() {
  const { Types } = require('mongoose');

  const balances = new Map();
  const ops = [];

  function toKey(itemId, locationId) {
    const i = (itemId && typeof itemId === 'object' && itemId.toHexString) ? itemId.toHexString() : String(itemId || '');
    const l = (locationId && typeof locationId === 'object' && locationId.toHexString) ? locationId.toHexString() : String(locationId || '');
    return `${i}|${l}`;
  }

  function makeQuery(executor) {
    const state = { lean: false };
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      session() { return this; },
      lean() { state.lean = true; return this; },
      then(resolve, reject) {
        try {
          const result = executor(state);
          return Promise.resolve(result).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
      },
      catch() { return this; },
      exec() { return executor(state); },
    };
  }

  // Mock StockBalance (new arch)
  const StockBalanceMock = {
    find(match = {}) {
      return makeQuery(() => {
        const items = [];
        for (const [key, doc] of balances.entries()) {
          const [i, l] = key.split('|');
          const matchItem = match.itemId ? String(match.itemId) === String(i) : true;
          const matchLoc = match.locationId ? String(match.locationId) === String(l) : true;
          if (matchItem && matchLoc) {
            items.push({ itemId: Types.ObjectId.createFromHexString(i), locationId: l ? Types.ObjectId.createFromHexString(l) : undefined, quantity: Number(doc.quantity || 0), reservedQuantity: Number(doc.reservedQuantity || 0), lastUpdatedAt: doc.lastUpdatedAt || new Date() });
          }
        }
        return items;
      });
    },
    findOne(match = {}) {
      return makeQuery(() => {
        const key = toKey(match.itemId, match.locationId);
        const doc = balances.get(key);
        if (!doc) return null;
        return { itemId: match.itemId, locationId: match.locationId, quantity: Number(doc.quantity || 0), reservedQuantity: Number(doc.reservedQuantity || 0), lastUpdatedAt: doc.lastUpdatedAt || new Date() };
      });
    },
    async updateOne(filter, update, opts = {}) {
      const key = toKey(filter.itemId, filter.locationId);
      const existing = balances.get(key) || { quantity: 0, reservedQuantity: 0, lastUpdatedAt: new Date() };
      const inc = (update && update.$inc) || {};
      const set = (update && update.$set) || {};
      const next = {
        quantity: Number(existing.quantity || 0) + Number(inc.quantity || 0),
        reservedQuantity: Number(existing.reservedQuantity || 0) + Number(inc.reservedQuantity || 0),
        lastUpdatedAt: set.lastUpdatedAt || new Date(),
      };
      balances.set(key, next);
      return { acknowledged: true, modifiedCount: 1, upsertedId: undefined };
    },
    __getAll() {
      const arr = [];
      for (const [key, doc] of balances.entries()) {
        const [i, l] = key.split('|');
        arr.push({ itemId: i, locationId: l || undefined, quantity: doc.quantity });
      }
      return arr;
    },
    __clear() { balances.clear(); },
  };

  // Mock StockOperation
  const StockOperationMock = {
    create(items) {
      const created = (Array.isArray(items) ? items : [items]).map((it) => ({ _id: new Types.ObjectId(), ...it }));
      ops.push(...created);
      return Promise.resolve(created);
    },
    findOne(match = {}) {
      return makeQuery(() => {
        const found = ops.find((op) => (!match.type || match.type === op.type)
          && (!match.sourceType || match.sourceType === op.sourceType)
          && (!match.sourceId || String(match.sourceId) === String(op.sourceId))
        );
        return found || null;
      });
    },
    __clear() { ops.length = 0; },
    __getAll() { return ops.slice(); },
  };

  // Use jest to mock modules by path that stockService requires
  jest.doMock('../../models/stock/StockBalance', () => StockBalanceMock);
  jest.doMock('../../models/stock/StockOperation', () => StockOperationMock);

  return { StockBalanceMock, StockOperationMock };
}

describe('Stocks v2 e2e: RBAC + adjust + transfer', () => {
  const originalEnv = { ...process.env };
  const itemId = '000000000000000000000101';
  const locA = '000000000000000000000201';
  const locB = '000000000000000000000202';
  let app;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.AUTH_DEV_MODE = '1';
    process.env.ENABLE_STOCKS = '1';
    mockMongooseSession();
    installStockModelMocks();
    app = makeApp();
  });

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('GET /api/stocks without role → 403', async () => {
    const res = await request(app).get('/api/stocks');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/stocks with Admin → 200 and ok:true', async () => {
    const res = await request(app)
      .get('/api/stocks')
      .set('x-user-id', 'u_admin')
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('Feature flag disabled → 404 STOCKS_DISABLED', async () => {
    process.env.ENABLE_STOCKS = '0';
    const res = await request(app)
      .get('/api/stocks')
      .set('x-user-id', 'u_admin')
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(404);
    expect(res.body && res.body.error).toBe('STOCKS_DISABLED');
  });

  test('POST /api/stocks/adjust with Admin → increments balance', async () => {
    const res = await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-role', 'Admin')
      .set('x-user-id', '000000000000000000000999')
      .send({ itemId, locationId: locA, qty: 5, note: 'seed' });
    console.log('DEBUG adjust +5', res.statusCode, res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    const get = await request(app)
      .get(`/api/stocks?itemId=${encodeURIComponent(itemId)}`)
      .set('x-user-id', 'u_admin')
      .set('x-user-role', 'Admin');
    console.log('DEBUG get balances', get.statusCode, get.body);
    expect(get.statusCode).toBe(200);
    const items = get.body.items || [];
    const found = items.find((x) => String(x.itemId) === itemId && String(x.locationId) === locA);
    expect(found && Number(found.quantity)).toBe(5);
  });

  test('POST /api/stocks/adjust negative beyond zero → 409', async () => {
    // start with +3
    await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId, locationId: locA, qty: 3 });

    const res = await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId, locationId: locA, qty: -10 });
    console.log('DEBUG adjust -10', res.statusCode, res.body);
    expect(res.statusCode).toBe(409);
    expect(res.body && res.body.error).toBe('NEGATIVE_BALANCE_FORBIDDEN');
  });

  test('POST /api/stocks/transfer with Admin → moves stock between locations', async () => {
    // seed +5 in locA
    await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId, locationId: locA, qty: 5 });

    const tr = await request(app)
      .post('/api/stocks/transfer')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId, from: locA, to: locB, qty: 3, note: 'move 3' });
    console.log('DEBUG transfer 3', tr.statusCode, tr.body);
    expect(tr.statusCode).toBe(200);
    expect(tr.body && tr.body.ok).toBe(true);

    const list = await request(app)
      .get(`/api/stocks?itemId=${encodeURIComponent(itemId)}`)
      .set('x-user-id', 'u_admin')
      .set('x-user-role', 'Admin');
    console.log('DEBUG list after transfer', list.statusCode, list.body);
    expect(list.statusCode).toBe(200);
    const items = list.body.items || [];
    const a = items.find((x) => String(x.itemId) === itemId && String(x.locationId) === locA);
    const b = items.find((x) => String(x.itemId) === itemId && String(x.locationId) === locB);
    expect(a && Number(a.quantity)).toBe(2);
    expect(b && Number(b.quantity)).toBe(3);
  });

  test('RBAC: Manager cannot adjust or transfer → 403', async () => {
    const adj = await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-id', 'u_mgr')
      .set('x-user-role', 'Manager')
      .send({ itemId, locationId: locA, qty: 1 });
    expect(adj.statusCode).toBe(403);

    const tr = await request(app)
      .post('/api/stocks/transfer')
      .set('x-user-id', 'u_mgr')
      .set('x-user-role', 'Manager')
      .send({ itemId, from: locA, to: locB, qty: 1 });
    expect(tr.statusCode).toBe(403);
  });
});