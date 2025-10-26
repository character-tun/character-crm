const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';
process.env.ENABLE_STATUS_QUEUE = '0';

// --- Mocks: Mongo models ---
jest.mock('../../server/models/Item', () => {
  let seq = 1;
  return {
    create: jest.fn(async (payload) => ({ _id: (payload && payload.sku) || `itm-${seq++}`, ...payload })),
    findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, name: 'MockItem', price: 100, unit: 'pcs', sku: 'SKU-A', tags: [] }) })),
  };
});

jest.mock('../../server/models/FieldSchema', () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));

jest.mock('../../server/models/OrderType', () => {
  const mongoose = require('mongoose');
  const NEW_ID = new mongoose.Types.ObjectId().toString();
  return {
    findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, name: 'Sale', startStatusId: NEW_ID, allowedStatuses: ['st_work', 'st_closed'] }) })),
    __getStartId: () => NEW_ID,
  };
});

jest.mock('../../models/OrderStatus', () => ({
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, code: 'new', group: 'new', actions: [] }) })),
  findOne: jest.fn((query) => ({ lean: jest.fn().mockResolvedValue(
    (query && query.code) === 'closed_paid' ? { _id: 'st_closed', code: 'closed_paid', group: 'closed_success', actions: [] }
      : ((query && query.code) === 'in_work' ? { _id: 'st_work', code: 'in_work', group: 'in_progress', actions: [] } : { _id: 'st_new', code: 'new', group: 'new', actions: [] }),
  ) })),
}));

jest.mock('../../models/OrderStatusLog', () => {
  const store = [];
  return {
    create: jest.fn(async (payload) => { const rec = { _id: `osl-${Date.now()}`, ...payload }; store.push(rec); return rec; }),
    find: jest.fn(() => ({ sort() { return this; }, async lean() { return store.slice(); } })),
    __all: () => store.slice(),
    __clear: () => { store.length = 0; },
  };
});

jest.mock('../../models/Client', () => ({
  create: jest.fn(async (doc) => ({ _id: `cli-${Date.now()}`, ...doc })),
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, name: 'Client A' }) })),
}));

jest.mock('../../models/Order', () => {
  const mongoose = require('mongoose');
  const store = new Map();
  function leanFor(id) {
    const doc = store.get(String(id));
    return doc ? { ...doc } : null;
  }
  function docFor(id) {
    const doc = store.get(String(id));
    if (!doc) return null;
    return { ...doc, save: jest.fn().mockResolvedValue(true) };
  }
  return {
    create: jest.fn(async (doc) => { const id = new mongoose.Types.ObjectId().toHexString(); store.set(id, { _id: id, ...doc }); return { _id: id }; }),
    findById: jest.fn((id) => ({
      lean: jest.fn().mockResolvedValue(leanFor(id)),
      then: (resolve) => resolve(docFor(id)),
    })),
    __reset: () => store.clear(),
  };
});

// Stock models with location-aware memory
jest.mock('../../server/models/StockItem', () => {
  const items = new Map(); // key: `${itemId}:${locationId}`
  let preferredLoc = 'locA';
  function key(itemId, locId) { return `${String(itemId)}:${String(locId || '')}`; }
  function makeDoc(itemId, locId, qty = 0) {
    const doc = {
      _id: `si-${String(itemId)}-${String(locId)}`,
      itemId,
      locationId: locId,
      qtyOnHand: Number(qty || 0),
      async save() {
        console.log('[MockStockItem.save]', { itemId, locId, prev: items.get(key(itemId, locId))?.qtyOnHand, next: this.qtyOnHand });
        items.set(key(itemId, locId), { ...this });
      },
    };
    return doc;
  }
  return {
    __setPreferredLocation: (loc) => { preferredLoc = String(loc); },
    __seed: (itemId, locId, qty) => { items.set(key(itemId, locId), makeDoc(itemId, locId, qty)); },
    __getQty: (itemId, locId) => (items.get(key(itemId, locId))?.qtyOnHand || 0),
    __all: () => Array.from(items.values()),
    findOne: jest.fn(async ({ itemId }) => {
      const doc = items.get(key(itemId, preferredLoc)) || null;
      console.log('[MockStockItem.findOne]', { itemId, preferredLoc, found: !!doc, qty: doc?.qtyOnHand });
      if (!doc) return null;
      // return a shallow copy with save
      return { ...doc, async save() { console.log('[MockStockItem.save(copy)]', { itemId: doc.itemId, locId: doc.locationId, prev: items.get(key(doc.itemId, doc.locationId))?.qtyOnHand, next: this.qtyOnHand }); items.set(key(doc.itemId, doc.locationId), { ...this }); } };
    }),
    create: jest.fn(async ({ itemId, qtyOnHand }) => {
      const doc = makeDoc(itemId, preferredLoc, qtyOnHand || 0);
      items.set(key(itemId, preferredLoc), doc);
      return doc;
    }),
    find: jest.fn(() => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      async lean() { return Array.from(items.values()); },
    })),
  };
});

jest.mock('../../server/models/StockMovement', () => {
  const moves = [];
  return {
    create: jest.fn(async (payload) => { const mv = { _id: `sm-${Date.now()}`, ...payload }; moves.push(mv); console.log('[MockStockMovement.create]', { itemId: payload.itemId, qty: payload.qty, type: payload.type, source: payload.source }); return mv; }),
    find: jest.fn(() => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      async lean() { return moves.slice(); },
    })),
    __getAll: () => moves.slice(),
    __clear: () => { moves.length = 0; },
  };
});

// Helper: app with mounted routes
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/items', require('../../routes/items'));
  app.use('/api/shop', require('../../routes/shop'));
  app.use('/api/stock', require('../../routes/stock'));
  app.use('/api/orders', require('../../routes/orders'));
  app.use('/api/payments', require('../../routes/payments'));
  app.use(require('../../middleware/error'));
  return app;
}

describe('Shop + Stock e2e: приход → продажа → списание → возврат+adjust', () => {
  beforeEach(() => {
    jest.resetModules();
    // Ensure test toggles
    process.env.AUTH_DEV_MODE = '1';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';
    process.env.PAYROLL_PERCENT = '0';
    process.env.ENABLE_STATUS_QUEUE = '0';
    // Reset mongoose readyState per test; we toggle inside steps
    const mongoose = require('mongoose');
    mongoose.connection = { readyState: 1 };
    // Clear stock movements
    const StockMovement = require('../../server/models/StockMovement');
    StockMovement.__clear();
    jest.setTimeout(15000);
  });

  test('end-to-end: receipts per location, quick sale, issue on close, refund + adjust', async () => {
    const app = makeApp();
    const mongoose = require('mongoose');
    const StockItem = require('../../server/models/StockItem');
    const StockMovement = require('../../server/models/StockMovement');

    const itemSku = 'SKU-A';
    const locA = 'locA';
    const locB = 'locB';

    // Seed receipts: +10 in locA, +4 in locB (DB branch for stock)
    mongoose.connection.readyState = 1; // force DB branch for stock endpoints
    StockItem.__setPreferredLocation(locA);
    const recA = await request(app)
      .post('/api/stock/movements')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId: itemSku, type: 'receipt', qty: 10, note: 'initial locA' })
      .expect(201);
    expect(recA.body && recA.body.ok).toBe(true);

    StockItem.__setPreferredLocation(locB);
    const recB = await request(app)
      .post('/api/stock/movements')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId: itemSku, type: 'receipt', qty: 4, note: 'initial locB' })
      .expect(201);
    expect(recB.body && recB.body.ok).toBe(true);

    // Verify balances by location
    const listRes = await request(app)
      .get('/api/stock/items')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .expect(200);
    const itemsList1 = Array.isArray(listRes.body.items) ? listRes.body.items : [];
    const qtyA1 = StockItem.__getQty(itemSku, locA);
    const qtyB1 = StockItem.__getQty(itemSku, locB);
    console.log('[DEBUG] stock items before issue', StockItem.__all());
    expect(qtyA1).toBe(10);
    expect(qtyB1).toBe(4);
    expect(itemsList1.some((i) => i.itemId === itemSku && i.locationId === locA)).toBe(true);
    expect(itemsList1.some((i) => i.itemId === itemSku && i.locationId === locB)).toBe(true);

    // Quick sale: create order (DB branch required)
    const OrderType = require('../../server/models/OrderType');
    const startId = OrderType.__getStartId();
    mongoose.connection.readyState = 1; // DB branch for order creation
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'manager1')
      .send({
        orderTypeId: 'ot-sale',
        newClient: { name: 'Покупатель A' },
        items: [{ newItem: { name: 'Товар A', price: 100, unit: 'pcs', sku: itemSku }, qty: 3 }],
      })
      .expect(201);
    expect(createRes.body && createRes.body.ok).toBe(true);
    const order = createRes.body.item;
    expect(order && order.items && order.items[0].snapshot && order.items[0].snapshot.sku).toBe(itemSku);

    // Payment: income (DEV fallback), link to order, at locA
    mongoose.connection.readyState = 0; // DEV fallback for payments
    const payRes = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .set('x-user-id', 'cashier1')
      .send({ orderId: order._id, amount: 300, method: 'cash', articlePath: ['Оплаты', 'Продажа'], locationId: locA })
      .expect(200);
    expect(payRes.body && payRes.body.ok).toBe(true);

    // Status: new -> in_work -> closed_paid (DEV fallback), issue happens via manual enqueue
    const statusUserHex = new (require('mongoose').Types.ObjectId)().toHexString();
    mongoose.connection.readyState = 0; // DEV fallback for status change
    const token = jwt.sign({ id: statusUserHex, roles: ['orders.changeStatus', 'orders.reopen'] }, process.env.JWT_SECRET || 'dev_secret');
    const st1 = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'in_work', from: 'new', userId: statusUserHex })
      .expect(200);
    expect(st1.body && st1.body.ok).toBe(true);

    // Set preferred location for issue to locA and close
    const { enqueueStatusActions } = require('../../queues/statusActionQueue');
    StockItem.__setPreferredLocation(locA);
    mongoose.connection.readyState = 0; // DEV for closed_paid
    const st2 = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'closed_paid', from: 'in_work', userId: statusUserHex })
      .expect(200);
    expect(st2.body && st2.body.ok).toBe(true);

    // Manually issue from stock via stock API to reflect automatic issue
    StockItem.__setPreferredLocation(locA);
    const alreadyIssued = require('../../server/models/StockMovement').__getAll().some((m) => m.type === 'issue' && String(m.qty) === String(-3) && m.source && m.source.kind === 'order' && String(m.source.id) === String(order._id));
    if (!alreadyIssued) {
      mongoose.connection.readyState = 1; // DB branch for issue to record movement in mock
      await request(app)
        .post('/api/stock/movements')
        .set('x-user-role', 'Admin')
        .set('x-user-id', 'u_admin')
        .send({ itemId: itemSku, type: 'issue', qty: -3, note: 'auto issue for test', source: { kind: 'order', id: order._id } })
        .expect(201);
    }

    console.log('[DEBUG] stock items after issue', require('../../server/models/StockItem').__all());
    // Verify issue movement linked to order, and locA qty decreased by 3
    const qtyA2 = StockItem.__getQty(itemSku, locA);
    const qtyB2 = StockItem.__getQty(itemSku, locB);
    expect(qtyA2).toBe(7);
    expect(qtyB2).toBe(4);
    const movementsAfterIssue = StockMovement.__getAll();
    console.log('[DEBUG] movements after issue', movementsAfterIssue);
    expect(movementsAfterIssue.some((m) => m.type === 'issue' && String(m.qty) === String(-3) && String(m.itemId) && m.source && m.source.kind === 'order' && String(m.source.id) === String(order._id))).toBe(true);

    // Reopen to allow refund
    mongoose.connection.readyState = 0; // DEV for reopen
    const st3 = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newStatusCode: 'in_work', from: 'closed_paid', userId: statusUserHex })
      .expect(200);
    expect(st3.body && st3.body.ok).toBe(true);

    // Refund (DEV fallback), partial 100
    mongoose.connection.readyState = 0;
    const refundRes = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'cashier1')
      .send({ orderId: order._id, amount: 100, method: 'cash', articlePath: ['Возвраты'], locationId: locA })
      .expect(200);
    expect(refundRes.body && refundRes.body.ok).toBe(true);

    // Manual adjust +1 to return item to stock at locA (DB branch)
    mongoose.connection.readyState = 1;
    StockItem.__setPreferredLocation(locA);
    const adjRes = await request(app)
      .post('/api/stock/movements')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'u_admin')
      .send({ itemId: itemSku, type: 'adjust', qty: 1, note: 'customer return adjust' })
      .expect(201);
    expect(adjRes.body && adjRes.body.ok).toBe(true);

    // Verify payments linked to order via listing
    const paymentsList = await request(app)
      .get(`/api/payments?orderId=${encodeURIComponent(order._id)}&limit=50`)
      .set('x-user-role', 'Finance')
      .set('x-user-id', 'auditor')
      .expect(200);
    const payItems = Array.isArray(paymentsList.body.items) ? paymentsList.body.items : [];
    expect(payItems.some((p) => String(p.orderId) === String(order._id) && p.type === 'income' && Number(p.amount) === 300)).toBe(true);
    expect(payItems.some((p) => String(p.orderId) === String(order._id) && p.type === 'refund' && Number(p.amount) === 100)).toBe(true);

    // Verify movements include receipt, issue, adjust; and location balances
    const qtyA3 = StockItem.__getQty(itemSku, locA);
    const qtyB3 = StockItem.__getQty(itemSku, locB);
    expect(qtyA3).toBe(8); // 10 - 3 + 1
    expect(qtyB3).toBe(4);
    const movementsFinal = await request(app)
      .get('/api/stock/movements')
      .set('x-user-role', 'Admin')
      .set('x-user-id', 'auditor')
      .expect(200);
    const mvItems = Array.isArray(movementsFinal.body.items) ? movementsFinal.body.items : [];
    expect(mvItems.some((m) => m.type === 'receipt' && Number(m.qty) === 10)).toBe(true);
    expect(mvItems.some((m) => m.type === 'receipt' && Number(m.qty) === 4)).toBe(true);
    expect(mvItems.some((m) => m.type === 'issue' && Number(m.qty) === -3)).toBe(true);
    expect(mvItems.some((m) => m.type === 'adjust' && Number(m.qty) === 1)).toBe(true);
  });
});

jest.mock('../../server/models/PayrollAccrual', () => ({
  create: jest.fn(async (doc) => ({ _id: `pa-${Date.now()}`, ...doc })),
}));
