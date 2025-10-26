/* eslint-env jest */

describe('services/paymentsService', () => {
  let paymentsService;
  let OrderMock;
  let PaymentMock;
  let CashRegisterMock;
  let OrderStatusLogMock;
  let lockedFlag;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.DEFAULT_CASH_REGISTER;
    process.env.CASH_LOCK_STRICT = '0';
    process.env.PAYMENTS_REFUND_ENABLED = '1';

    const ORDER_HEX = '507f1f77bcf86cd799439011';
    const USER_HEX = '60af924b2b8e2a5f3c4d5e6f';
    const LOC_HEX = '64dbf8889f1b1ab2c3d4e5f6';

    // ---- Order mock
    const orderDoc = { _id: ORDER_HEX, locationId: LOC_HEX, paymentsLocked: false, closed: null };
    OrderMock = {
      findById: jest.fn((id) => ({ lean: () => Promise.resolve(id === ORDER_HEX ? orderDoc : null) })),
    };
    jest.doMock('../models/Order', () => OrderMock, { virtual: true });

    // ---- Payment mock
    lockedFlag = false;
    PaymentMock = {
      create: jest.fn((payload) => Promise.resolve({ _id: 'pay1', ...payload })),
      findById: jest.fn((id) => {
        const doc = { _id: id, orderId: ORDER_HEX, locked: lockedFlag, save: jest.fn(async () => {}) };
        const wrapper = { ...doc, lean: () => Promise.resolve(doc) };
        return wrapper;
      }),
      findByIdAndUpdate: jest.fn((id, update) => ({
        lean: () => Promise.resolve({ _id: id, ...update.$set }),
      })),
    };
    jest.doMock('../server/models/Payment', () => PaymentMock, { virtual: true });

    // ---- CashRegister mock
    const cashObj = { _id: '507f1f77bcf86cd799439012', isSystem: true, code: 'main' };
    CashRegisterMock = {
      findById: jest.fn((id) => ({ lean: () => Promise.resolve(null) })), // not found by id
      findOne: jest.fn((filter) => {
        if (filter && filter.code === 'main') { return { lean: () => Promise.resolve(cashObj) }; }
        if (filter && filter.defaultForLocation) { return { lean: () => Promise.resolve(cashObj) }; }
        if (filter && filter.isSystem && filter.code === 'main') { return { lean: () => Promise.resolve(cashObj) }; }
        return { lean: () => Promise.resolve(cashObj) };
      }),
    };
    jest.doMock('../server/models/CashRegister', () => CashRegisterMock, { virtual: true });

    // ---- Audit log mock
    OrderStatusLogMock = { create: jest.fn(() => Promise.resolve({ _id: 'log1' })) };
    jest.doMock('../models/OrderStatusLog', () => OrderStatusLogMock, { virtual: true });

    // ---- Require service with mocks in place
    paymentsService = require('../services/paymentsService.js');

    // Expose IDs to tests via globals
    global.__ORDER_HEX = ORDER_HEX;
    global.__USER_HEX = USER_HEX;
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('createPayment: success with defaults and env DEFAULT_CASH_REGISTER', async () => {
    process.env.DEFAULT_CASH_REGISTER = 'main';
    const res = await paymentsService.createPayment({ orderId: global.__ORDER_HEX, amount: 100 }, { id: global.__USER_HEX });
    expect(res).toEqual({ ok: true, id: expect.anything() });
    expect(PaymentMock.create).toHaveBeenCalledTimes(1);
    const payload = PaymentMock.create.mock.calls[0][0];
    expect(payload.type).toBe('income');
    expect(payload.articlePath).toEqual(['Продажи', 'Касса']);
    expect(payload.amount).toBe(100);
    expect(String(payload.cashRegisterId)).toMatch(/^[a-f0-9]{24}$/i);
    expect(String(payload.locationId)).toMatch(/^[a-f0-9]{24}$/i);
    expect(OrderStatusLogMock.create).toHaveBeenCalled();
    const note = OrderStatusLogMock.create.mock.calls[0][0].note;
    expect(String(note)).toContain('PAYMENT_CREATE');
  });

  test('createPayment: VALIDATION_ERROR on non-positive amount', async () => {
    await expect(paymentsService.createPayment({ orderId: global.__ORDER_HEX, amount: 0 }, { id: global.__USER_HEX }))
      .rejects.toMatchObject({ statusCode: 400, message: 'VALIDATION_ERROR' });
  });

  test('createPayment: refund uses default articlePath ["Возвраты"]', async () => {
    process.env.DEFAULT_CASH_REGISTER = 'main';
    const res = await paymentsService.createPayment({ orderId: global.__ORDER_HEX, type: 'refund', amount: 50 }, { id: global.__USER_HEX });
    expect(res).toEqual({ ok: true, id: expect.anything() });
    const payload = PaymentMock.create.mock.calls[PaymentMock.create.mock.calls.length - 1][0];
    expect(payload.type).toBe('refund');
    expect(payload.articlePath).toEqual(['Возвраты']);
  });

  test('updatePayment: strict lock (CASH_LOCK_STRICT=1) forbids update', async () => {
    process.env.CASH_LOCK_STRICT = '1';
    lockedFlag = true;
    await expect(paymentsService.updatePayment('pay1', { note: 'x' }, { id: 'user1' }))
      .rejects.toMatchObject({ statusCode: 403, message: 'PAYMENT_LOCKED' });
  });

  test('updatePayment: forbids changing type and lock flags', async () => {
    await expect(paymentsService.updatePayment('pay1', { type: 'expense' }, { id: 'user1' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'VALIDATION_ERROR' });
    await expect(paymentsService.updatePayment('pay1', { locked: true }, { id: 'user1' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'VALIDATION_ERROR' });
  });

  test('refundPayment: disabled by env PAYMENTS_REFUND_ENABLED=0', async () => {
    process.env.PAYMENTS_REFUND_ENABLED = '0';
    await expect(paymentsService.refundPayment(null, { orderId: global.__ORDER_HEX, amount: 10 }, { id: global.__USER_HEX }))
      .rejects.toMatchObject({ statusCode: 403, message: 'REFUND_DISABLED' });
  });

  test('lockPayment: sets flags and writes audit', async () => {
    const res = await paymentsService.lockPayment('pay1', { id: global.__USER_HEX });
    expect(res).toEqual({ ok: true, item: expect.any(Object) });
    expect(PaymentMock.findById).toHaveBeenCalledWith('pay1');
    const doc = PaymentMock.findById.mock.results[0].value; // our wrapper
    expect(doc.locked).toBe(true);
    expect(doc.lockedAt).toBeInstanceOf(Date);
    expect(OrderStatusLogMock.create).toHaveBeenCalled();
    const note = OrderStatusLogMock.create.mock.calls[OrderStatusLogMock.create.mock.calls.length - 1][0].note;
    expect(String(note)).toContain('PAYMENT_LOCK');
  });
});