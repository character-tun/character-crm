const mongoose = require('mongoose');

mongoose.connection = mongoose.connection || {};
mongoose.connection.readyState = 1;
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

// Валидные ObjectId
const ITEM_ID = '000000000000000000000001';
const LOC_A = '00000000000000000000000a';
const LOC_B = '00000000000000000000000b';

jest.mock('../../models/stock/StockBalance', () => ({
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

jest.mock('../../models/stock/StockOperation', () => ({
  create: jest.fn(async (docs) => {
    const created = docs.map((d) => ({ ...d, _id: `op_${global.mockMem.operations.length + 1}` }));
    global.mockMem.operations.push(...created);
    return created;
  }),
}));

const stockService = require('../../services/stock/stockService');

function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  mem.balances.set(key(itemId, locationId), { quantity, reservedQuantity });
}

beforeEach(() => {
  mem.balances = new Map();
  mem.operations = [];
});

describe('E2E: перемещение между локациями', () => {
  test('перемещение переносит количество и создаёт оперцию transfer; инварианты', async () => {
    seedBalance(ITEM_ID, LOC_A, 7, 1); // available=6
    seedBalance(ITEM_ID, LOC_B, 2, 0);

    const res = await stockService.transfer({ itemId: ITEM_ID, from: LOC_A, to: LOC_B, qty: 5, userId: 'u1' });
    expect(res.ok).toBe(true);

    const a = mem.balances.get(key(ITEM_ID, LOC_A));
    const b = mem.balances.get(key(ITEM_ID, LOC_B));
    expect(a.quantity).toBe(2);
    expect(b.quantity).toBe(7);
    expect(mem.operations.filter((op) => op.type === 'transfer')).toHaveLength(1);

    // инварианты
    const aAvail = a.quantity - a.reservedQuantity;
    const bAvail = b.quantity - b.reservedQuantity;
    expect(a.quantity).toBeGreaterThanOrEqual(0);
    expect(a.reservedQuantity).toBeGreaterThanOrEqual(0);
    expect(aAvail).toBeGreaterThanOrEqual(0);
    expect(b.quantity).toBeGreaterThanOrEqual(0);
    expect(b.reservedQuantity).toBeGreaterThanOrEqual(0);
    expect(bAvail).toBeGreaterThanOrEqual(0);
  });

  test('ошибка при недостатке на исходной локации', async () => {
    seedBalance(ITEM_ID, LOC_A, 1, 0);
    seedBalance(ITEM_ID, LOC_B, 0, 0);
    await expect(stockService.transfer({ itemId: ITEM_ID, from: LOC_A, to: LOC_B, qty: 2, userId: 'u1' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'INSUFFICIENT_STOCK' });
  });
});