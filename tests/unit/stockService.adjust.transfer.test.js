const mongoose = require('mongoose');

// Ensure DB ready state for services
mongoose.connection = mongoose.connection || {};
mongoose.connection.readyState = 1;

// Stub session
mongoose.startSession = jest.fn(async () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
}));

process.env.ENABLE_STOCKS = '1';

// Глобальная память для моков
global.mockMem = global.mockMem || { balances: new Map(), operations: [] };
const mem = global.mockMem;
function key(itemId, locationId) { return `${String(itemId)}:${String(locationId)}`; }
// Валидные ObjectId для item/location
const ITEM_ID = '000000000000000000000001';
const LOC_A = '00000000000000000000000a';
const LOC_B = '00000000000000000000000b';

// Mock StockBalance
jest.mock('../../models/stock/StockBalance', () => ({
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
  aggregate: jest.fn(async (pipeline) => {
    // Simple aggregation to support summaryByLocation
    // group by locationId and sum quantity + reservedQuantity
    const groups = new Map();
    for (const [k, v] of global.mockMem.balances.entries()) {
      const [, locIdStr] = k.split(':');
      const g = groups.get(locIdStr) || { sumQty: 0, sumReserved: 0 };
      g.sumQty += Number(v.quantity || 0);
      g.sumReserved += Number(v.reservedQuantity || 0);
      groups.set(locIdStr, g);
    }
    let arr = Array.from(groups.entries()).map(([locId, g]) => ({ _id: locId, sumQty: g.sumQty, sumReserved: g.sumReserved }));
    // apply sort + limit if present
    const sortStage = pipeline.find((p) => p.$sort);
    if (sortStage && sortStage.$sort.sumQty === -1) arr = arr.sort((a, b) => b.sumQty - a.sumQty);
    const limitStage = pipeline.find((p) => p.$limit);
    if (limitStage) arr = arr.slice(0, limitStage.$limit);
    return arr;
  }),
}));

// Mock StockOperation
jest.mock('../../models/stock/StockOperation', () => ({
  create: jest.fn(async (docs) => {
    const created = docs.map((d) => ({ ...d, _id: `op_${global.mockMem.operations.length + 1}` }));
    global.mockMem.operations.push(...created);
    return created;
  }),
  findOne: jest.fn((query) => ({
    session: () => global.mockMem.operations.find((op) => (
      String(op.type) === String(query.type)
        && String(op.sourceType || '') === String(query.sourceType || '')
        && String(op.sourceId || '') === String(query.sourceId || '')
        && String(op.itemId || '') === String(query.itemId || '')
        && Number(op.qty || 0) === Number(query.qty || 0)
    )) || null,
  })),
  aggregate: jest.fn(async (pipeline) => []),
}));

// Service under test
const stockService = require('../../services/stock/stockService');

// Helpers to seed
function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  mem.balances.set(key(itemId, locationId), { quantity, reservedQuantity });
}

beforeEach(() => {
  // reset mem before each test
  mem.balances = new Map();
  mem.operations = [];
});

describe('stockService.adjust', () => {
  test('приход (+) увеличивает количество, создаёт операцию in', async () => {
    const itemId = ITEM_ID; const locId = LOC_A;
    seedBalance(itemId, locId, 5, 0);
    const res = await stockService.adjust({ itemId, locationId: locId, qty: 3, userId: 'u1' });
    expect(res.ok).toBe(true);
    expect(res.item.quantity).toBe(8);
    expect(mem.operations).toHaveLength(1);
    expect(mem.operations[0].type).toBe('in');
    expect(mem.operations[0].locationIdTo).toBeDefined();
  });

  test('расход (-) уменьшает количество, создаёт операцию out', async () => {
    const itemId = ITEM_ID; const locId = LOC_A;
    seedBalance(itemId, locId, 10, 0);
    const res = await stockService.adjust({ itemId, locationId: locId, qty: -4, userId: 'u1' });
    expect(res.ok).toBe(true);
    expect(res.item.quantity).toBe(6);
    expect(mem.operations).toHaveLength(1);
    expect(mem.operations[0].type).toBe('out');
    expect(mem.operations[0].locationIdFrom).toBeDefined();
  });

  test('запрет отрицательного остатка: ошибка 409 NEGATIVE_BALANCE_FORBIDDEN', async () => {
    const itemId = ITEM_ID; const locId = LOC_A;
    seedBalance(itemId, locId, 2, 0);
    await expect(stockService.adjust({ itemId, locationId: locId, qty: -3, userId: 'u1' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'NEGATIVE_BALANCE_FORBIDDEN' });
    // операции не создаются
    expect(mem.operations).toHaveLength(0);
    // баланс не меняется
    const b = mem.balances.get(key(itemId, locId));
    expect(b.quantity).toBe(2);
  });
});

describe('stockService.transfer', () => {
  test('перемещение между локациями: happy path', async () => {
    const itemId = ITEM_ID; const from = LOC_A; const to = LOC_B;
    seedBalance(itemId, from, 5, 0);
    seedBalance(itemId, to, 1, 0);

    const res = await stockService.transfer({ itemId, from, to, qty: 3, userId: 'u1' });
    expect(res.ok).toBe(true);
    const fromBal = mem.balances.get(key(itemId, from));
    const toBal = mem.balances.get(key(itemId, to));
    expect(fromBal.quantity).toBe(2);
    expect(toBal.quantity).toBe(4);
    expect(mem.operations).toHaveLength(1);
    expect(mem.operations[0].type).toBe('transfer');
  });

  test('недостаток на исходной локации: ошибка 409 INSUFFICIENT_STOCK', async () => {
    const itemId = ITEM_ID; const from = LOC_A; const to = LOC_B;
    seedBalance(itemId, from, 2, 0);
    seedBalance(itemId, to, 0, 0);

    await expect(stockService.transfer({ itemId, from, to, qty: 3, userId: 'u1' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'INSUFFICIENT_STOCK' });
    // операции не создаются
    expect(mem.operations).toHaveLength(0);
    // балансы не меняются
    const fromBal = mem.balances.get(key(itemId, from));
    const toBal = mem.balances.get(key(itemId, to));
    expect(fromBal.quantity).toBe(2);
    expect(toBal.quantity).toBe(0);
  });
});