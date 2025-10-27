const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';
process.env.ENABLE_STOCKS = '1';

const mongoose = require('mongoose');

mongoose.connection = mongoose.connection || {};
mongoose.connection.readyState = 1;
mongoose.startSession = jest.fn(async () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
}));

// Глобальная память для моков
global.mockMem = global.mockMem || { balances: new Map(), operations: [] };
const mem = global.mockMem;
function key(itemId, locationId) { return `${String(itemId)}:${String(locationId)}`; }
const ITEM_ID = new mongoose.Types.ObjectId('64b000000000000000000001');
const LOC_A = new mongoose.Types.ObjectId('64b00000000000000000000a');
const LOC_B = new mongoose.Types.ObjectId('64b00000000000000000000b');

jest.mock('../models/stock/StockBalance', () => ({
  find: jest.fn((match = {}) => ({
    sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => {
      const items = [];
      for (const [k, v] of global.mockMem.balances.entries()) {
        const [itemIdStr, locIdStr] = k.split(':');
        const okItem = !match.itemId || String(match.itemId) === itemIdStr;
        const okLoc = !match.locationId || String(match.locationId) === locIdStr;
        if (okItem && okLoc) items.push({ itemId: itemIdStr, locationId: locIdStr, quantity: v.quantity || 0, reservedQuantity: v.reservedQuantity || 0 });
      }
      return items;
    } }) }) }) })),
  findOne: jest.fn((filter) => ({
    session: () => {
      const k = `${String(filter.itemId)}:${String(filter.locationId)}`;
      const v = global.mockMem.balances.get(k);
      if (!v) return null;
      return { itemId: filter.itemId, locationId: filter.locationId, quantity: v.quantity || 0, reservedQuantity: v.reservedQuantity || 0 };
    },
    lean: async () => {
      const k = `${String(filter.itemId)}:${String(filter.locationId)}`;
      const v = global.mockMem.balances.get(k);
      if (!v) return null;
      return { itemId: filter.itemId, locationId: filter.locationId, quantity: v.quantity || 0, reservedQuantity: v.reservedQuantity || 0 };
    },
  })),
  updateOne: jest.fn(async (filter, update) => {
    const k = `${String(filter.itemId)}:${String(filter.locationId)}`;
    const cur = global.mockMem.balances.get(k) || { quantity: 0, reservedQuantity: 0 };
    const inc = (update.$inc || {});
    const set = (update.$set || {});
    const next = {
      quantity: (typeof inc.quantity === 'number' ? cur.quantity + inc.quantity : cur.quantity),
      reservedQuantity: (typeof inc.reservedQuantity === 'number' ? cur.reservedQuantity + inc.reservedQuantity : (typeof set.reservedQuantity === 'number' ? set.reservedQuantity : cur.reservedQuantity)),
      lastUpdatedAt: set.lastUpdatedAt || cur.lastUpdatedAt,
    };
    global.mockMem.balances.set(k, next);
    return { acknowledged: true };
  }),
}));

jest.mock('../models/stock/StockOperation', () => ({
  create: jest.fn(async (docs) => {
    const created = docs.map((d) => ({ ...d, _id: `op_${global.mockMem.operations.length + 1}` }));
    global.mockMem.operations.push(...created);
    return created;
  }),
}));

const stocksRouter = require('../routes/stocks');
const { withUser } = require('../middleware/auth');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    // Dev auth headers
    req.headers['x-user-id'] = req.headers['x-user-id'] || 'u1';
    req.headers['x-user-name'] = req.headers['x-user-name'] || 'Dev User';
    req.headers['x-user-role'] = req.headers['x-user-role'] || 'Admin';
    next();
  });
  app.use(withUser);
  app.use('/api/stocks', stocksRouter);
  return app;
}

function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  mem.balances.set(key(itemId, locationId), { quantity, reservedQuantity });
}

beforeEach(() => { mem.balances = new Map(); mem.operations = []; });

describe('Контракты /api/stocks*', () => {
  test('GET /api/stocks возвращает список items', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 1);
    seedBalance('i2', 'b', 3, 0);
    const app = makeApp();
    const res = await request(app)
      .get('/api/stocks?limit=50&offset=0')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  test('POST /api/stocks/adjust — валидация: qty!=0', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'Admin')
      .send({ itemId: 'i1', locationId: 'a', qty: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('POST /api/stocks/adjust — ошибка 409 NEGATIVE_BALANCE_FORBIDDEN', async () => {
    seedBalance('i1', 'a', 1, 0);
    const app = makeApp();
    const res = await request(app)
      .post('/api/stocks/adjust')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'Admin')
      .send({ itemId: 'i1', locationId: 'a', qty: -2 });
    expect(res.statusCode).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('NEGATIVE_BALANCE_FORBIDDEN');
  });

  test('POST /api/stocks/transfer — успешный ответ с items', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 0);
    seedBalance(ITEM_ID, LOC_B, 1, 0);
    const app = makeApp();
    const res = await request(app)
      .post('/api/stocks/transfer')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'Admin')
      .send({ itemId: ITEM_ID, from: LOC_A, to: LOC_B, qty: 3 });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(2);
  });

  test('Auth guard: 401 без пользователя', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/stocks', stocksRouter);
    const res = await request(app).post('/api/stocks/adjust').send({ itemId: 'i1', locationId: 'a', qty: 1 });
    // middleware requireAuth вернёт 401
    expect([401, 403, 404]).toContain(res.statusCode);
  });
});