const mongoose = require('mongoose');

mongoose.connection = mongoose.connection || {};
mongoose.connection.readyState = 1;
mongoose.startSession = jest.fn(async () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
}));

process.env.ENABLE_STOCKS_V2 = '1';
// Валидный ObjectId для дефолтной локации
const LOC_A = '00000000000000000000000a';
process.env.DEFAULT_STOCK_LOCATION_ID = LOC_A;

// Глобальная память для моков
global.mockMem = global.mockMem || { balances: new Map(), operations: [], orders: new Map() };
const mem = global.mockMem;
function key(itemId, locationId) { return `${String(itemId)}:${String(locationId)}`; }

// Валидный ObjectId для товара и локаций
const ITEM_ID = '000000000000000000000001';
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
  find: jest.fn((match = {}) => ({
    lean: async () => {
      const items = [];
      for (const [k, v] of global.mockMem.balances.entries()) {
        const [itemIdStr, locIdStr] = k.split(':');
        const okItem = !match.itemId || String(match.itemId) === itemIdStr;
        const okLoc = !match.locationId || String(match.locationId) === locIdStr;
        if (okItem && okLoc) items.push({ itemId: itemIdStr, locationId: locIdStr, quantity: v.quantity || 0, reservedQuantity: v.reservedQuantity || 0 });
      }
      return items;
    },
  })),
}));

jest.mock('../../models/stock/StockOperation', () => ({
  create: jest.fn(async (docs) => {
    const created = docs.map((d) => ({ ...d, _id: `op_${global.mockMem.operations.length + 1}` }));
    global.mockMem.operations.push(...created);
    return created;
  }),
  findOne: jest.fn((query) => ({
    session: () => {
      return global.mockMem.operations.find((op) => (
        String(op.type) === String(query.type)
        && String(op.sourceType || '') === String(query.sourceType || '')
        && String(op.sourceId || '') === String(query.sourceId || '')
        && String(op.itemId || '') === String(query.itemId || '')
        && Number(op.qty || 0) === Number(query.qty || 0)
      )) || null;
    },
  })),
  aggregate: jest.fn(async () => []),
}));

jest.mock('../../models/Order', () => ({
  findById: jest.fn((id) => ({ lean: async () => global.mockMem.orders.get(String(id)) || null })),
}));

const reservationService = require('../../services/stock/reservationService');
const stockService = require('../../services/stock/stockService');

function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  mem.balances.set(key(itemId, locationId), { quantity, reservedQuantity });
}
function seedOrder(orderId, items, locationId = LOC_A) { mem.orders.set(String(orderId), { _id: String(orderId), items, locationId }); }

beforeEach(() => {
  mem.balances = new Map();
  mem.operations = [];
  mem.orders = new Map();
});

describe('E2E: заказ — резерв → списание (issue), отмена → unreserve, возврат/рефанд → приход', () => {
  test('create → reserve → close(out)', async () => {
    seedBalance(ITEM_ID, LOC_A, 10, 0);
    seedOrder('o1', [{ itemId: ITEM_ID, qty: 4 }]);

    const r1 = await reservationService.reserveForOrder({ orderId: 'o1', locationId: LOC_A, userId: 'u1' });
    expect(r1.ok).toBe(true);
    let bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(4);

    const issue = await stockService.issueFromOrder({ orderId: 'o1', performedBy: 'u1', locationId: LOC_A });
    expect(issue.ok).toBe(true);
    bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.quantity).toBe(6); // 10 - 4
    expect(bal.reservedQuantity).toBe(0); // 4 зарезервировано, списание уменьшило резерв
    expect(mem.operations.filter((op) => op.type === 'out')).toHaveLength(1);

    // Идемпотентность: повторный issue не создаёт дубликаты операций
    const issue2 = await stockService.issueFromOrder({ orderId: 'o1', performedBy: 'u1', locationId: LOC_A });
    expect(issue2.ok).toBe(true);
    expect(mem.operations.filter((op) => op.type === 'out')).toHaveLength(1);
  });

  test('cancel/delete → unreserve', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 3);
    seedOrder('o2', [{ itemId: ITEM_ID, qty: 3 }]);

    const rel = await reservationService.releaseForOrder({ orderId: 'o2', locationId: LOC_A, userId: 'u1' });
    expect(rel.ok).toBe(true);
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(0);
  });

  test('return/refund → in (идемпотентно)', async () => {
    seedBalance(ITEM_ID, LOC_A, 2, 0);
    seedOrder('o3', [{ itemId: ITEM_ID, qty: 2 }], LOC_A);

    const ret = await stockService.returnFromRefund({ orderId: 'o3', paymentId: 'p1', locationId: LOC_A, performedBy: 'u1' });
    expect(ret.ok).toBe(true);
    let bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.quantity).toBe(4); // +2
    expect(mem.operations.filter((op) => op.type === 'return')).toHaveLength(1);

    const ret2 = await stockService.returnFromRefund({ orderId: 'o3', paymentId: 'p1', locationId: LOC_A, performedBy: 'u1' });
    expect(ret2.ok).toBe(true);
    expect(mem.operations.filter((op) => op.type === 'return')).toHaveLength(1);
  });

  test('инварианты остатков: quantity>=0, reserved>=0, available>=0', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 0);
    seedOrder('o4', [{ itemId: ITEM_ID, qty: 5 }]);
    await reservationService.reserveForOrder({ orderId: 'o4', locationId: LOC_A, userId: 'u1' });
    await stockService.issueFromOrder({ orderId: 'o4', performedBy: 'u1', locationId: LOC_A });

    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    const available = bal.quantity - bal.reservedQuantity;
    expect(bal.quantity).toBeGreaterThanOrEqual(0);
    expect(bal.reservedQuantity).toBeGreaterThanOrEqual(0);
    expect(available).toBeGreaterThanOrEqual(0);
  });
});