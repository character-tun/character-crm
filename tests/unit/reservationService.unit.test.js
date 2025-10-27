const mongoose = require('mongoose');

mongoose.connection = mongoose.connection || {};
mongoose.connection.readyState = 1;
mongoose.startSession = jest.fn(async () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
}));

// Переносим mem в глобальную область, чтобы jest.mock не ссылался на out-of-scope
global.mockMem = global.mockMem || { balances: new Map(), orders: new Map() };
const mem = global.mockMem;
function key(itemId, locationId) { return `${String(itemId)}:${String(locationId)}`; }

// Валидные ObjectId для item/location
const ITEM_ID = '000000000000000000000001';
const LOC_A = '00000000000000000000000a';

jest.mock('../../models/stock/StockBalance', () => ({
  findOne: jest.fn((filter) => ({
    session: () => {
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

jest.mock('../../models/Order', () => ({
  findById: jest.fn((id) => ({ lean: async () => global.mockMem.orders.get(String(id)) || null })),
}));

const { reserveForOrder, releaseForOrder, applyDiffForOrderEdit } = require('../../services/stock/reservationService');

function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  global.mockMem.balances.set(key(itemId, locationId), { quantity, reservedQuantity });
}
function seedOrder(orderId, items) { global.mockMem.orders.set(String(orderId), { _id: String(orderId), items }); }

beforeEach(() => {
  global.mockMem.balances = new Map();
  global.mockMem.orders = new Map();
  process.env.DEFAULT_STOCK_LOCATION_ID = LOC_A;
});

describe('reservationService.reserveForOrder', () => {
  test('резервирует доступное количество; available не уходит в минус', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 0);
    seedOrder('o1', [{ itemId: ITEM_ID, qty: 3 }]);

    const res = await reserveForOrder({ orderId: 'o1', locationId: LOC_A, userId: 'u1' });
    expect(res.ok).toBe(true);
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(3);
    expect(bal.quantity - bal.reservedQuantity).toBe(2);
  });

  test('ошибка при недостатке доступного: 409 INSUFFICIENT_STOCK', async () => {
    seedBalance(ITEM_ID, LOC_A, 2, 1); // available = 1
    seedOrder('o1', [{ itemId: ITEM_ID, qty: 2 }]);
    await expect(reserveForOrder({ orderId: 'o1', locationId: LOC_A, userId: 'u1' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'INSUFFICIENT_STOCK' });
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(1);
  });
});

describe('reservationService.releaseForOrder', () => {
  test('освобождает резерв; кламп до >=0', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 3);
    seedOrder('o1', [{ itemId: ITEM_ID, qty: 4 }]);

    const res = await releaseForOrder({ orderId: 'o1', locationId: LOC_A, userId: 'u1' });
    expect(res.ok).toBe(true);
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(0); // 3 - 4 => 0 (clamped)
  });
});

describe('reservationService.applyDiffForOrderEdit', () => {
  test('увеличение дельты резервов при достатке доступного', async () => {
    seedBalance(ITEM_ID, LOC_A, 10, 2); // available=8
    const prevItems = [{ itemId: ITEM_ID, qty: 1 }];
    const nextItems = [{ itemId: ITEM_ID, qty: 5 }]; // delta=+4 <= available

    const res = await applyDiffForOrderEdit({ orderId: 'o1', prevItems, nextItems, locationId: LOC_A, userId: 'u1' });
    expect(res.ok).toBe(true);
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(6); // 2 + 4
  });

  test('ошибка при увеличении дельты сверх доступного: 409 INSUFFICIENT_STOCK', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 4); // available=1
    const prevItems = [{ itemId: ITEM_ID, qty: 1 }];
    const nextItems = [{ itemId: ITEM_ID, qty: 4 }]; // delta=+3 > available

    await expect(applyDiffForOrderEdit({ orderId: 'o1', prevItems, nextItems, locationId: LOC_A, userId: 'u1' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'INSUFFICIENT_STOCK' });
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(4);
  });

  test('уменьшение дельты резервов', async () => {
    seedBalance(ITEM_ID, LOC_A, 5, 4);
    const prevItems = [{ itemId: ITEM_ID, qty: 4 }];
    const nextItems = [{ itemId: ITEM_ID, qty: 1 }]; // delta=-3

    const res = await applyDiffForOrderEdit({ orderId: 'o1', prevItems, nextItems, locationId: LOC_A, userId: 'u1' });
    expect(res.ok).toBe(true);
    const bal = mem.balances.get(key(ITEM_ID, LOC_A));
    expect(bal.reservedQuantity).toBe(1); // 4 - 3
  });
});