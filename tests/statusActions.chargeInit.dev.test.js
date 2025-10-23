// DEV mode for unit testing
process.env.AUTH_DEV_MODE = '1';

describe('statusActionsHandler — chargeInit (Mongo-only mocks)', () => {
  beforeEach(() => { jest.resetModules(); });

  test('creates payment with provided amount', async () => {
    const payments = [];

    // Mock models
    jest.doMock('../models/Order', () => ({
      findById: jest.fn((id) => {
        const leanDoc = { _id: id, totals: { grandTotal: 500 }, paymentsLocked: false, closed: undefined };
        const modelDoc = { _id: id, paymentsLocked: false, closed: undefined, save: jest.fn().mockResolvedValue(true) };
        return {
          lean: jest.fn().mockResolvedValue(leanDoc),
          then: (resolve) => resolve(modelDoc),
        };
      }),
    }));
    jest.doMock('../server/models/CashRegister', () => ({
      findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439021', code: 'main' }) })),
    }));
    jest.doMock('../server/models/Payment', () => ({
      create: jest.fn(async (data) => { payments.push(data); return { _id: `pay-${payments.length}`, ...data }; }),
      aggregate: jest.fn(async (pipeline) => {
        const matchStage = Array.isArray(pipeline) ? pipeline.find((s) => s.$match) : null;
        const orderId = matchStage?.$match?.orderId;
        const sum = payments.filter((p) => String(p.orderId) === String(orderId)).reduce((a, p) => a + Number(p.amount || 0), 0);
        return sum > 0 ? [{ _id: null, amountSum: sum }] : [];
      }),
    }));
    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn().mockResolvedValue({ _id: 'log-1' }) }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const orderId = '507f1f77bcf86cd799439001';
    const userId = '507f1f77bcf86cd799439002';

    const res = await handleStatusActions({
      orderId,
      statusCode: 'in_work',
      actions: [{ type: 'charge', amount: 123.45 }],
      logId: 'log-1',
      userId,
    });

    expect(res && res.ok).toBe(true);
    const found = payments.find((i) => String(i.orderId) === String(orderId));
    expect(found).toBeTruthy();
    expect(found.type).toBe('income');
    expect(Number(found.amount)).toBeCloseTo(123.45);
    expect(String(found.note || '')).toMatch(/chargeInit/i);
  });

  test('throws when payments are locked (via closeWithoutPayment)', async () => {
    const payments = [];

    const orderDoc = { _id: '507f1f77bcf86cd799439003', total: 200, paymentsLocked: false, closed: false, save: jest.fn().mockResolvedValue(true) };

    jest.doMock('../models/Order', () => ({
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue({ _id: id, totals: { grandTotal: orderDoc.total }, paymentsLocked: orderDoc.paymentsLocked, closed: orderDoc.closed }),
        then: (resolve) => resolve(orderDoc),
      })),
    }));
    jest.doMock('../server/models/CashRegister', () => ({
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ _id: 'cr-1', code: 'main' }) })),
    }));
    jest.doMock('../server/models/Payment', () => ({
      create: jest.fn(async (data) => { payments.push(data); return { _id: `pay-${payments.length}`, ...data }; }),
      aggregate: jest.fn(async () => []),
    }));
    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn().mockResolvedValue({ _Id: 'log-2' }) }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const orderId = '507f1f77bcf86cd799439003';
    const userId = '507f1f77bcf86cd799439004';

    // First, mark order as closed without payment (locks payments)
    await handleStatusActions({
      orderId,
      statusCode: 'closed_unpaid',
      actions: [{ type: 'closeWithoutPayment' }],
      logId: 'log-2',
      userId,
    });

    // Then, attempt to charge => should throw
    let threw = false;
    try {
      await handleStatusActions({
        orderId,
        statusCode: 'in_work',
        actions: [{ type: 'charge', amount: 10 }],
        logId: 'log-3',
        userId,
      });
    } catch (e) {
      threw = true;
      expect(String(e.message || '')).toMatch(/PAYMENTS_LOCKED|ORDER_CLOSED/);
    }
    expect(threw).toBe(true);
    // Ensure no payments were created
    expect(payments.length).toBe(0);
    // Verify order state reflects locked payments
    expect(orderDoc.paymentsLocked).toBe(true);
  });
});