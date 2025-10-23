const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';
process.env.PAYROLL_PERCENT = '0.1';

// Mock required models for DEV flow (each mock maintains its own store)
jest.mock('../../models/Order', () => {
  const store = new Map();
  return {
    exists: jest.fn(),
    create: jest.fn(async (doc) => {
      const _id = (doc && doc._id) ? String(doc._id) : new (require('mongoose').Types.ObjectId)().toHexString();
      const created = { _id, ...doc };
      store.set(_id, created);
      return created;
    }),
    findById: jest.fn((id) => ({
      lean: jest.fn().mockResolvedValue(store.get(id) || null),
    })),
    findByIdAndUpdate: jest.fn((id, upd) => ({
      lean: jest.fn().mockResolvedValue(() => {
        const prev = store.get(id);
        if (!prev) return null;
        const next = { ...prev, ...((upd && upd.$set) || {}) };
        store.set(id, next);
        return next;
      }),
    })),
    find: jest.fn(() => ({ sort: jest.fn(() => ({ skip: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(Array.from(store.values())) })) })) })) })),
    __clear: () => { store.clear(); },
  };
});

jest.mock('../../models/OrderStatusLog', () => {
  const logs = [];
  return {
    find: jest.fn((q) => ({
      sort: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(
          logs.filter((l) => String(l.orderId) === String(q.orderId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        ),
      })),
    })),
    create: jest.fn(async (doc) => {
      const entry = { _id: `log_${Date.now()}`, createdAt: new Date().toISOString(), ...doc };
      logs.push(entry);
      return entry;
    }),
    __clear: () => { logs.length = 0; },
  };
});

jest.mock('../../server/models/PayrollAccrual', () => {
  const accruals = [];
  return {
    create: jest.fn(async (doc) => {
      const entry = { _id: `pa_${Date.now()}`, ...doc };
      accruals.push(entry);
      return entry;
    }),
    __getAll: () => accruals.slice(),
    __clear: () => { accruals.length = 0; },
  };
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/orders', require('../../routes/orders'));
  app.use(require('../../middleware/error'));
  return app;
}

describe('Payroll accrual (e2e): правило 10% на closed_success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // ensure mocks are re-applied and stores cleared
    const OrderStatusLog = require('../../models/OrderStatusLog');
    const Order = require('../../models/Order');
    const PayrollAccrual = require('../../server/models/PayrollAccrual');
    OrderStatusLog.__clear();
    Order.__clear();
    PayrollAccrual.__clear();
  });

  test('закрытие заказа создаёт один PayrollAccrual с 10% от суммы', async () => {
    const mongoose = require('mongoose');
    const userHex = new mongoose.Types.ObjectId().toHexString();

    // Seed order directly via model mock
    const Order = require('../../models/Order');
    const created = await Order.create({
      _id: new mongoose.Types.ObjectId().toHexString(),
      status: 'in_work',
      items: [
        { itemId: 'it_svc', qty: 1, total: 200, snapshot: { name: 'Услуга Y', price: 200 } },
      ],
      totals: { subtotal: 200, discountTotal: 0, grandTotal: 200 },
      orderTypeId: 'ot_payroll',
    });
    const orderId = created._id;

    // Directly invoke status actions handler with a valid logId
    const { handleStatusActions } = require('../../services/statusActionsHandler');
    const validLogId = new mongoose.Types.ObjectId().toHexString();
    await handleStatusActions({
      orderId,
      statusCode: 'closed_paid',
      actions: ['payrollAccrual'],
      logId: validLogId,
      userId: userHex,
    });

    const PayrollAccrual = require('../../server/models/PayrollAccrual');
    const list = PayrollAccrual.__getAll();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1); // не дублируется

    const acc = list[0];
    expect(acc).toBeTruthy();
    expect(acc.baseAmount).toBe(200);
    expect(acc.percent).toBe(0.1);
    expect(acc.amount).toBe(20); // 10% от 200
    expect(String(acc.createdBy)).toBe(userHex);
    expect(String(acc.orderId)).toBe(String(orderId));
  });
});