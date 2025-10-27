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

// Валидные ObjectId-строки для стабильных тестов
const OIDS = {
  locA: '507f1f77bcf86cd799439011',
  locB: '507f1f77bcf86cd799439012',
  item1: '507f1f77bcf86cd799439013',
  item2: '507f1f77bcf86cd799439014',
  order1: '507f1f77bcf86cd799439015',
  order2: '507f1f77bcf86cd799439016',
  order3: '507f1f77bcf86cd799439017',
  payment1: '507f1f77bcf86cd799439018',
};

// Глобальное хранилище, чтобы использовать его внутри jest.mock фабрик
global.mockMem = {
  balances: new Map(), // key: `${itemId}:${locationId}` -> { quantity, reservedQuantity }
  operations: [],
  orders: new Map(), // key: orderId -> { items: [{ itemId, qty }], locationId? }
};

// Mock StockBalance
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
}));

// Mock Order
jest.mock('../../models/Order', () => ({
  findById: jest.fn((orderId) => ({
    lean: async () => global.mockMem.orders.get(String(orderId)) || null,
  })),
}));

// Service under test
const stockService = require('../../services/stock/stockService');

// Helpers to seed
function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  const k = `${String(itemId)}:${String(locationId)}`;
  global.mockMem.balances.set(k, { quantity, reservedQuantity });
}
function seedOrder(orderId, locationId, items = []) {
  global.mockMem.orders.set(String(orderId), { items, locationId });
}

beforeEach(() => {
  global.mockMem.balances = new Map();
  global.mockMem.operations = [];
  global.mockMem.orders = new Map();
  delete process.env.DEFAULT_STOCK_LOCATION_ID;
});

describe('stockService.issueFromOrder', () => {
  test('списывает остаток и уменьшает резерв; создаёт out операции', async () => {
    const orderId = OIDS.order1; const locId = OIDS.locA; const itemId = OIDS.item1;
    seedOrder(orderId, undefined, [{ itemId, qty: 3 }]);
    seedBalance(itemId, locId, 10, 2);
    process.env.DEFAULT_STOCK_LOCATION_ID = locId; // используем дефолтную локацию

    const res = await stockService.issueFromOrder({ orderId, performedBy: 'u1' });
    expect(res.ok).toBe(true);
    expect(res.processed).toBe(1);
    const k = `${String(itemId)}:${String(locId)}`;
    const b = global.mockMem.balances.get(k);
    expect(b.quantity).toBe(7);
    expect(b.reservedQuantity).toBe(0); // резерв уменьшился на min(reserved, qty)=2
    expect(global.mockMem.operations).toHaveLength(1);
    expect(global.mockMem.operations[0].type).toBe('out');
    expect(global.mockMem.operations[0].sourceType).toBe('order');
  });

  test('идемпотентность: повторный вызов не создаёт дубль операции и не меняет баланс', async () => {
    const orderId = OIDS.order2; const locId = OIDS.locA; const itemId = OIDS.item1;
    seedOrder(orderId, undefined, [{ itemId, qty: 2 }]);
    seedBalance(itemId, locId, 5, 0);
    process.env.DEFAULT_STOCK_LOCATION_ID = locId;

    const first = await stockService.issueFromOrder({ orderId, performedBy: 'u1' });
    expect(first.ok).toBe(true);
    expect(first.processed).toBe(1);
    const k = `${String(itemId)}:${String(locId)}`;
    const afterFirst = global.mockMem.balances.get(k);
    expect(afterFirst.quantity).toBe(3);
    expect(global.mockMem.operations).toHaveLength(1);

    const second = await stockService.issueFromOrder({ orderId, performedBy: 'u1' });
    expect(second.ok).toBe(true);
    expect(second.processed).toBe(1); // второй раз просто пропускает из-за dup
    const afterSecond = global.mockMem.balances.get(k);
    expect(afterSecond.quantity).toBe(3);
    expect(global.mockMem.operations).toHaveLength(1);
  });

  test('недостаток остатка: { ok:false, statusCode:409 } и баланс не меняется', async () => {
    const orderId = OIDS.order3; const locId = OIDS.locA; const itemId = OIDS.item2;
    seedOrder(orderId, undefined, [{ itemId, qty: 6 }]);
    seedBalance(itemId, locId, 5, 0);
    process.env.DEFAULT_STOCK_LOCATION_ID = locId;

    const res = await stockService.issueFromOrder({ orderId, performedBy: 'u1' });
    expect(res.ok).toBe(false);
    expect(res.statusCode).toBe(409);
    const k = `${String(itemId)}:${String(locId)}`;
    const b = global.mockMem.balances.get(k);
    expect(b.quantity).toBe(5);
    expect(global.mockMem.operations).toHaveLength(0);
  });
});

describe('stockService.returnFromRefund', () => {
  test('возвращает на склад и создаёт return операции', async () => {
    const orderId = OIDS.order1; const locId = OIDS.locB; const itemId = OIDS.item2;
    seedOrder(orderId, locId, [{ itemId, qty: 4 }]);
    seedBalance(itemId, locId, 1, 0);

    const res = await stockService.returnFromRefund({ orderId, paymentId: OIDS.payment1, locationId: locId, performedBy: 'u1' });
    expect(res.ok).toBe(true);
    expect(res.processed).toBe(1);
    const k = `${String(itemId)}:${String(locId)}`;
    const b = global.mockMem.balances.get(k);
    expect(b.quantity).toBe(5);
    expect(global.mockMem.operations).toHaveLength(1);
    expect(global.mockMem.operations[0].type).toBe('return');
    expect(global.mockMem.operations[0].sourceType).toBe('payment');
  });

  test('идемпотентность по paymentId: повторный вызов не создаёт дубль', async () => {
    const orderId = OIDS.order2; const locId = OIDS.locB; const itemId = OIDS.item2;
    seedOrder(orderId, locId, [{ itemId, qty: 1 }]);
    seedBalance(itemId, locId, 0, 0);

    const first = await stockService.returnFromRefund({ orderId, paymentId: OIDS.payment1, locationId: locId, performedBy: 'u1' });
    expect(first.ok).toBe(true);
    expect(first.processed).toBe(1);
    const k = `${String(itemId)}:${String(locId)}`;
    const afterFirst = global.mockMem.balances.get(k);
    expect(afterFirst.quantity).toBe(1);
    expect(global.mockMem.operations).toHaveLength(1);

    const second = await stockService.returnFromRefund({ orderId, paymentId: OIDS.payment1, locationId: locId, performedBy: 'u1' });
    expect(second.ok).toBe(true);
    expect(second.processed).toBe(1);
    const afterSecond = global.mockMem.balances.get(k);
    expect(afterSecond.quantity).toBe(1);
    expect(global.mockMem.operations).toHaveLength(1);
  });
});