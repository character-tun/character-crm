const mongoose = require('mongoose');

// Force PROD-like branch by simulating an active Mongo connection
try { mongoose.connection.readyState = 1; } catch (e) {
  Object.defineProperty(mongoose, 'connection', { value: { readyState: 1 }, configurable: true });
}

// Mocks for models used by statusActionsHandler Mongo branch
jest.mock('../server/models/Payment', () => ({
  aggregate: jest.fn(async () => []),
  create: jest.fn(async (payload) => ({ _id: 'p_m_1', ...payload })),
}));

jest.mock('../server/models/CashRegister', () => ({
  findOne: jest.fn((query) => ({
    lean: jest.fn().mockResolvedValue(query && query.defaultForLocation ? { _id: '507f1f77bcf86cd799439021' } : null),
  })),
}));

jest.mock('../models/Order', () => {
  const state = { doc: null };
  return {
    __setOrder(doc) { state.doc = doc; },
    findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(state.doc) })),
  };
});

jest.mock('../models/OrderStatusLog', () => ({
  create: jest.fn(async () => ({ _id: 'log_m_1' })),
}));

const Payment = require('../server/models/Payment');
const CashRegister = require('../server/models/CashRegister');
const Order = require('../models/Order');
const OrderStatusLog = require('../models/OrderStatusLog');

process.env.AUTH_DEV_MODE = '0';

describe('statusActionsHandler — chargeInit (Mongo branch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure Mongo-ready branch
    try { mongoose.connection.readyState = 1; } catch {}
  });

  test('creates payment using remaining when amount not provided', async () => {
    const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
    __devReset();

    Order.__setOrder({
      _id: '507f1f77bcf86cd799439011',
      paymentsLocked: false,
      closed: undefined,
      totals: { grandTotal: 250 },
    });

    const res = await handleStatusActions({
      orderId: '507f1f77bcf86cd799439011',
      statusCode: 'in_work',
      actions: [{ type: 'charge' }],
      logId: 'log-m-1',
      userId: '507f1f77bcf86cd799439012',
    });

    expect(res && res.ok).toBe(true);


    expect(Payment.create).toHaveBeenCalledTimes(1);
    const payload = Payment.create.mock.calls[0][0];
    expect(payload && payload.type).toBe('income');
    expect(Array.isArray(payload.articlePath)).toBe(true);
    expect(Number(payload.amount)).toBeCloseTo(250);
    expect(payload && payload.method).toBe('auto');

    // Cash register selection happened
    expect(CashRegister.findOne).toHaveBeenCalled();

    // Audit log created
    expect(OrderStatusLog.create).toHaveBeenCalledTimes(1);
  });

  test('throws PAYMENTS_LOCKED when order has paymentsLocked=true', async () => {
    const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
    __devReset();

    Order.__setOrder({ _id: '507f1f77bcf86cd799439013', paymentsLocked: true, totals: { grandTotal: 100 } });

    await expect(handleStatusActions({
      orderId: '507f1f77bcf86cd799439013', statusCode: 'in_work', actions: [{ type: 'charge' }], logId: 'log-m-2', userId: '507f1f77bcf86cd799439014',
    })).rejects.toThrow(/PAYMENTS_LOCKED/);

    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('skips with NO_REMAINING when fully paid', async () => {
    const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
    __devReset();

    // Fully paid: grandTotal=100, income aggregated=100
    Order.__setOrder({ _id: '507f1f77bcf86cd799439015', paymentsLocked: false, totals: { grandTotal: 100 } });
    Payment.aggregate.mockResolvedValueOnce([{ _id: 'income', sum: 100 }]);

    const res = await handleStatusActions({
      orderId: '507f1f77bcf86cd799439015', statusCode: 'in_work', actions: [{ type: 'charge' }], logId: 'log-m-3', userId: '507f1f77bcf86cd799439016',
    });

    expect(res && res.ok).toBe(true);


    expect(Payment.create).not.toHaveBeenCalled();
  });
});