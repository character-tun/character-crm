const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

// Mock models used by Orders and Payments routes (DB branch)
jest.mock('../server/models/OrderType', () => ({
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({
    _id: id,
    code: 'type-e2e',
    allowedStatuses: ['st_new', 'st_in_work', 'st_closed_paid'],
    startStatusId: 'st_new',
  }) }) ),
}));

jest.mock('../models/OrderStatus', () => ({
  // Will configure returns per-test with mockReturnValueOnce for findOne
  findOne: jest.fn(),
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'st_new', code: 'new', group: 'draft', actions: [] }) })),
}));

jest.mock('../models/OrderStatusLog', () => {
  const mem = [];
  return {
    create: jest.fn(async (doc) => {
      const rec = { ...doc, orderId: String(doc.orderId), _id: `log_${Date.now()}`, createdAt: new Date().toISOString() };
      mem.push(rec);
      return rec;
    }),
    find: jest.fn((query) => ({
      sort: () => ({ lean: async () => mem.filter((l) => String(l.orderId) === String(query && query.orderId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) })
    })),
  };
});

jest.mock('../queues/statusActionQueue', () => ({
  enqueueStatusActions: jest.fn(async () => ({ ok: true })),
}));

jest.mock('../server/models/Item', () => ({
  create: jest.fn(async (doc) => ({ ...doc, _id: `it_${Date.now()}` })),
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, name: 'PreItem', price: 50, unit: 'pc' }) })),
}));

jest.mock('../models/Client', () => ({
  create: jest.fn(async (doc) => ({ ...doc, _id: `client_${Date.now()}` })),
}));

jest.mock('../models/Order', () => {
  const mem = new Map();
  const makeDoc = (obj) => ({
    ...obj,
    save: jest.fn(async function save() { mem.set(String(this._id), { ...this }); return this; }),
    lean: jest.fn(async function lean() { return { ...obj }; }),
  });
  return {
    create: jest.fn(async (doc) => {
      // Use a valid 24-char ObjectId-like string so mongoose.Types.ObjectId(orderId) works
      const id = '507f1f77bcf86cd799439011';
      const created = { ...doc, _id: id, createdAt: new Date().toISOString() };
      mem.set(String(id), created);
      return { _id: id };
    }),
    findById: jest.fn((id) => {
      const v = mem.get(String(id));
      if (!v) return { lean: jest.fn(async () => null) };
      return makeDoc(v);
    }),
    findByIdAndUpdate: jest.fn(async (id, { $set }, { new: isNew }) => {
      const cur = mem.get(String(id));
      if (!cur) return null;
      const next = { ...cur, ...($set || {}) };
      mem.set(String(id), next);
      return { ...(isNew ? next : cur) };
    }),
    find: jest.fn((match = {}) => ({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => Array.from(mem.values()) }) }) })
    })),
  };
});

jest.mock('../server/models/Payment', () => {
  const mem = [];
  return {
    create: jest.fn(async (doc) => {
      const id = `pay_${Date.now()}`;
      const item = { ...doc, _id: id, createdAt: new Date().toISOString() };
      mem.push(item);
      return item;
    }),
    find: jest.fn((match = {}) => ({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => mem.filter((p) => (!match.orderId || String(p.orderId) === String(match.orderId))) }) }) })
    })),
    aggregate: jest.fn(async (pipeline) => {
      const matchStage = (pipeline || []).find((st) => st.$match);
      const match = matchStage && matchStage.$match ? matchStage.$match : {};
      const items = mem.filter((p) => {
        let ok = true;
        if (match.orderId) ok = ok && (String(p.orderId) === String(match.orderId));
        if (match.type) ok = ok && (p.type === match.type);
        return ok;
      });
      const sums = items.reduce((acc, it) => { acc[it.type] = (acc[it.type] || 0) + (it.amount || 0); return acc; }, {});
      return Object.keys(sums).map((k) => ({ _id: k, sum: sums[k] }));
    }),
    findById: jest.fn((id) => ({
      lean: async () => mem.find((p) => String(p._id) === String(id)) || null,
    })),
    findByIdAndUpdate: jest.fn((id, patch, opts) => ({
      lean: async () => {
        const idx = mem.findIndex((p) => String(p._id) === String(id));
        if (idx === -1) return null;
        const next = { ...mem[idx], ...(patch && patch.$set ? patch.$set : {}) };
        mem[idx] = next;
        return next;
      },
    })),
    deleteOne: jest.fn(async ({ _id }) => {
      const idx = mem.findIndex((p) => String(p._id) === String(_id));
      if (idx !== -1) mem.splice(idx, 1);
      return { acknowledged: true, deletedCount: idx !== -1 ? 1 : 0 };
    }),
  };
});

jest.mock('../server/models/CashRegister', () => ({
  findById: jest.fn((id) => ({
    lean: jest.fn().mockResolvedValue({ _id: String(id), code: 'main' }),
  })),
  findOne: jest.fn((query) => ({
    lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012', code: 'main', defaultForLocation: true, isSystem: true }),
  })),
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Orders lifecycle e2e — create → pay → refund → close', () => {
  const OrderStatus = require('../models/OrderStatus');
  const { enqueueStatusActions } = require('../queues/statusActionQueue');

  beforeEach(() => {
    jest.clearAllMocks();
    // Force DB branch
    const mongoose = require('mongoose');
    mongoose.connection.readyState = 1;
    // Ensure mongoReady() sees a db object
    mongoose.connection.db = {};
  });

  test('Full lifecycle with new client and item', async () => {
    const app = makeApp();

    // Create order with orderType and new client+item
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'Admin')
      .send({
        orderTypeId: 'ot_e2e',
        newClient: { name: 'Client E2E', phone: '+7 900 000-00-00' },
        items: [ { qty: 1, newItem: { name: 'Товар', price: 100, unit: 'pc' } } ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body && createRes.body.ok).toBe(true);
    const orderId = createRes.body.item._id;
    expect(createRes.body.item && createRes.body.item.status).toBe('new');
    expect(createRes.body.item && createRes.body.item.clientId).toBeTruthy();
    expect(createRes.body.item.totals && createRes.body.item.totals.grandTotal).toBe(100);

    // Add income payment
    const payRes = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, type: 'income', amount: 100 });
    expect(payRes.status).toBe(200);
    expect(payRes.body && payRes.body.ok).toBe(true);

    // Add refund
    const refundRes = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 30 });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body && refundRes.body.ok).toBe(true);

    // Check payments totals
    const listRes = await request(app)
      .get(`/api/payments?orderId=${orderId}`)
      .set('x-user-role', 'Finance');
    expect(listRes.status).toBe(200);
    expect(listRes.body && listRes.body.ok).toBe(true);
    expect(listRes.body.totals && listRes.body.totals.income).toBe(100);
    expect(listRes.body.totals && listRes.body.totals.refund).toBe(30);
    expect(listRes.body.totals && listRes.body.totals.balance).toBe(70);

    // Prepare status mocks: current=draft, next=closed_success
    OrderStatus.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'new', group: 'draft', actions: [] }) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'st_closed_paid', code: 'closed_paid', group: 'closed_success', actions: [] }) });

    // Close order
    const closeRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', '507f1f77bcf86cd799439013')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'closed_paid', userId: '507f1f77bcf86cd799439013' });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body && closeRes.body.ok).toBe(true);

    // enqueueStatusActions should be called with stockIssue appended
    expect(enqueueStatusActions).toHaveBeenCalled();
    const call = enqueueStatusActions.mock.calls[0][0];
    expect(call.orderId).toBe(orderId);
    expect(call.statusCode).toBe('closed_paid');
    expect(Array.isArray(call.actions)).toBe(true);
    expect(call.actions).toContain('stockIssue');

    // Attempt adding payment after closed → ORDER_CLOSED
    const pay2 = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, type: 'income', amount: 10 });
    expect(pay2.status).toBe(400);
    expect(pay2.body && pay2.body.error).toBe('ORDER_CLOSED');

    // Verify status logs include last change
    const logsRes = await request(app)
      .get(`/api/orders/${orderId}/status-logs`);
    expect(logsRes.status).toBe(200);
    const logs = logsRes.body;
    expect(Array.isArray(logs)).toBe(true);
    const last = logs[0];
    expect(last && last.to).toBe('closed_paid');
  });
});