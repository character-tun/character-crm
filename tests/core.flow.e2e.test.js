const request = require('supertest');
const express = require('express');

// Ensure DEV mode paths are available for DEV fallbacks
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';

// In-memory stores moved into each mock to avoid out-of-scope references

// Mock DB models used by routes and status actions
jest.mock('../server/models/OrderType', () => ({
  findById: jest.fn((id) => ({
    lean: jest.fn().mockResolvedValue({ _id: id, code: 'type-core', isSystem: false, allowedStatuses: ['st_new', 'st_in_work', 'st_closed_paid'], startStatusId: 'st_new' }),
  })),
}));

jest.mock('../models/OrderStatus', () => ({
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'st_new', code: 'new', group: 'draft', actions: [] }) })),
  findOne: jest.fn(({ code }) => ({
    lean: jest.fn().mockResolvedValue(
      code === 'new'
        ? { _id: 'st_new', code: 'new', group: 'draft', actions: [] }
        : code === 'in_work'
        ? { _id: 'st_in_work', code: 'in_work', group: 'in_progress', actions: [] }
        : code === 'closed_paid'
        ? { _id: 'st_closed_paid', code: 'closed_paid', group: 'closed_success', actions: [{ type: 'payrollAccrual' }] }
        : null
    ),
  })),
}));

jest.mock('../models/Client', () => ({
  create: jest.fn(async (doc) => ({ _id: `cli_${Date.now()}`, ...doc })),
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id }) })),
}));

jest.mock('../server/models/Item', () => ({
  create: jest.fn(async (doc) => ({ _id: `it_${Date.now()}`, ...doc })),
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id }) })),
}));

jest.mock('../models/Order', () => {
  const mongoose = require('mongoose');
  const memOrders = new Map();
  return {
    exists: jest.fn(),
    create: jest.fn(async (doc) => {
      const _id = new mongoose.Types.ObjectId().toString();
      const created = { _id, ...doc };
      memOrders.set(_id, created);
      return created;
    }),
    findById: jest.fn((id) => ({
      lean: jest.fn().mockResolvedValue(memOrders.get(id) || {
        _id: id,
        status: 'new',
        paymentsLocked: false,
        items: [{ itemId: 'it_x', qty: 2, price: 100 }],
        totals: { subtotal: 200, discountTotal: 0, grandTotal: 200 },
        orderTypeId: 'ot_core',
      }),
    })),
    __reset: () => { memOrders.clear(); },
  };
});

jest.mock('../models/OrderStatusLog', () => {
  const memLogs = [];
  return {
    find: jest.fn((q) => ({
      sort: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(
          memLogs
            .filter((l) => String(l.orderId) === String(q.orderId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        ),
      })),
    })),
    create: jest.fn(async (doc) => {
      const entry = { _id: `log_${Date.now()}`, createdAt: new Date().toISOString(), ...doc };
      memLogs.push(entry);
      return entry;
    }),
    __reset: () => { memLogs.length = 0; },
  };
});

jest.mock('../server/models/PayrollAccrual', () => ({
  create: jest.fn(async (doc) => ({ _id: `pa_${Date.now()}`, ...doc })),
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

describe('Core flow (e2e): клиент→заказ→позиции→платёж→статусы→закрытие→таймлайн', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Re-apply mocks after reset
    // Note: re-requiring mocks ensures they remain active
    require('../server/models/OrderType');
    require('../models/OrderStatus');
    require('../models/Client');
    require('../server/models/Item');
    const orderModel = require('../models/Order');
    const logModel = require('../models/OrderStatusLog');
    require('../server/models/PayrollAccrual');
    if (typeof orderModel.__reset === 'function') orderModel.__reset();
    if (typeof logModel.__reset === 'function') logModel.__reset();
  });

  test('end-to-end core flow', async () => {
    const mongoose = require('mongoose');

    // 1) Create order (DB branch required)
    mongoose.connection.readyState = 1;
    const app = makeApp();
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'Admin')
      .send({
        orderTypeId: 'ot_core',
        newClient: { name: 'Client A', phone: '+111' },
        items: [
          { qty: 2, price: 100, newItem: { name: 'Service X' } },
        ],
      })
      .expect(201);
    expect(createRes.body && createRes.body.ok).toBe(true);
    const orderId = createRes.body.item._id || createRes.body.item.id;
    expect(orderId).toBeTruthy();

    // 2) Create payment (DEV fallback)
    mongoose.connection.readyState = 0; // force DEV fallback for payments
    const payRes = await request(app)
      .post('/api/payments')
      .set('x-user-id', 'u-pay')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 200, type: 'income', method: 'manual' })
      .expect(200);
    expect(payRes.body && payRes.body.ok).toBe(true);
    expect(typeof payRes.body.id).toBe('string');

    // 3) Change status to in_work (DEV fallback)
    const st1 = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', 'u-status')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', userId: 'u-status' })
      .expect(200);
    expect(st1.body && st1.body.ok).toBe(true);

    // 4) Change status to closed_paid (DEV fallback, enqueue payrollAccrual & stockIssue)
    const st2 = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', 'u-status')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'closed_paid', userId: 'u-status' })
      .expect(200);
    expect(st2.body && st2.body.ok).toBe(true);

    // 5) Attempt another payment → ORDER_CLOSED (DEV fallback)
    const payBlocked = await request(app)
      .post('/api/payments')
      .set('x-user-id', 'u-pay')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 10, type: 'income', method: 'manual' });
    expect(payBlocked.status).toBe(400);
    expect(payBlocked.body && payBlocked.body.error).toBe('ORDER_CLOSED');

    // 6) Verify payments aggregated for the order (DEV fallback)
    const listRes = await request(app)
      .get(`/api/payments?orderId=${orderId}`)
      .set('x-user-role', 'Finance')
      .expect(200);
    expect(listRes.body && listRes.body.totals && listRes.body.totals.income).toBeGreaterThanOrEqual(200);

    // 7) Read timeline with Mongo ready (DB branch)
    mongoose.connection.readyState = 1; // force DB for timeline
    const timelineRes = await request(app)
      .get(`/api/orders/${orderId}/timeline`)
      .set('Authorization', 'Bearer test') // any bearer: withUser accepts dev
      .expect(200);
    const timeline = timelineRes.body;
    expect(Array.isArray(timeline)).toBe(true);
    // At least one payroll accrual audit log
    const hasPayrollLog = timeline.some((l) => String(l.note || '').includes('STATUS_ACTION_PAYROLL'));
    expect(hasPayrollLog).toBe(true);
  });
});