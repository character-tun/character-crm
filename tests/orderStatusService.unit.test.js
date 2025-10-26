/* eslint-env jest */

describe('services/orderStatusService.changeOrderStatus', () => {
  let svc;
  let OrderMock;
  let OrderStatusMock;
  let OrderStatusLogMock;
  let OrderTypeMock;
  let enqueueMock;

  beforeEach(() => {
    jest.resetModules();

    // ---- Order mock
    let orderDoc = { _id: '507f1f77bcf86cd799439011', status: 'in_work', save: jest.fn(async () => {}) };
    OrderMock = {
      findById: jest.fn((id) => (id === '507f1f77bcf86cd799439011' ? orderDoc : null)),
    };
    jest.doMock('../models/Order', () => OrderMock, { virtual: true });

    // ---- OrderStatus mock
    OrderStatusMock = {
      findOne: jest.fn((filter) => ({
        lean: () => Promise.resolve((() => {
          const code = filter && filter.code;
          if (code === 'closed_paid') return { _id: 'st1', code: 'closed_paid', group: 'closed_success', actions: [] };
          if (code === 'closed_fail') return { _id: 'st2', code: 'closed_fail', group: 'closed_fail', actions: [] };
          if (code === 'in_work') return { _id: 'st3', code: 'in_work', group: 'work', actions: [] };
          // For current status lookup
          if (code) return null;
          return null;
        })()),
      })),
    };
    jest.doMock('../models/OrderStatus', () => OrderStatusMock, { virtual: true });

    // ---- Log + queue mocks
    OrderStatusLogMock = { create: jest.fn(async () => ({ _id: 'log1' })) };
    jest.doMock('../models/OrderStatusLog', () => OrderStatusLogMock, { virtual: true });

    enqueueMock = jest.fn(async () => {});
    jest.doMock('../queues/statusActionQueue', () => ({ enqueueStatusActions: enqueueMock }));

    // ---- OrderType mock (server path)
    OrderTypeMock = {
      findById: jest.fn((id) => ({ lean: () => Promise.resolve({ _id: id, allowedStatuses: ['st1'] }) })),
    };
    jest.doMock('../server/models/OrderType', () => OrderTypeMock, { virtual: true });

    svc = require('../services/orderStatusService.js');

    global.__ORDER_HEX = '507f1f77bcf86cd799439011';
    global.__USER_HEX = '60af924b2b8e2a5f3c4d5e6f';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('closed_success: sets closed=true and enqueues stockIssue when missing', async () => {
    const res = await svc.changeOrderStatus({ orderId: global.__ORDER_HEX, newStatusCode: 'closed_paid', userId: global.__USER_HEX });
    expect(res).toEqual({ ok: true });
    // Order updated
    const doc = OrderMock.findById.mock.results[0].value;
    expect(doc.status).toBe('closed_paid');
    expect(doc.closed && doc.closed.success).toBe(true);
    expect(OrderStatusLogMock.create).toHaveBeenCalledTimes(1);
    const args = OrderStatusLogMock.create.mock.calls[0][0];
    expect(args.actionsEnqueued).toContain('stockIssue');
    expect(args.userId).toBeDefined();
    // Enqueue called with augmented actions
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ actions: expect.arrayContaining(['stockIssue']) }));
  });

  test('closed_fail: sets closed=false and does not add stockIssue', async () => {
    const res = await svc.changeOrderStatus({ orderId: global.__ORDER_HEX, newStatusCode: 'closed_fail', userId: global.__USER_HEX });
    expect(res).toEqual({ ok: true });
    const doc = OrderMock.findById.mock.results[0].value;
    expect(doc.closed && doc.closed.success).toBe(false);
    const args = OrderStatusLogMock.create.mock.calls[0][0];
    expect(args.actionsEnqueued).toEqual([]);
  });

  test('STATUS_NOT_ALLOWED: rejects when OrderType.allowedStatuses excludes new status', async () => {
    // Reconfigure OrderType: disallow st1
    OrderTypeMock.findById.mockImplementation((id) => ({ lean: () => Promise.resolve({ _id: id, allowedStatuses: ['stX'] }) }));
    // Mark order with type
    const ord = OrderMock.findById(global.__ORDER_HEX);
    ord.orderTypeId = 'ot1';
    await expect(svc.changeOrderStatus({ orderId: global.__ORDER_HEX, newStatusCode: 'closed_paid', userId: global.__USER_HEX }))
      .rejects.toMatchObject({ statusCode: 409, message: 'STATUS_NOT_ALLOWED' });
  });

  test('REOPEN_FORBIDDEN: cannot change from closed_* without orders.reopen role', async () => {
    // Current status set to closed_fail
    const ord = OrderMock.findById(global.__ORDER_HEX);
    ord.status = 'closed_fail';
    await expect(svc.changeOrderStatus({ orderId: global.__ORDER_HEX, newStatusCode: 'in_work', userId: global.__USER_HEX }))
      .rejects.toMatchObject({ statusCode: 403, message: 'REOPEN_FORBIDDEN' });
  });

  test('Status not found: 404', async () => {
    // Mock returns null for unknown code
    OrderStatusMock.findOne.mockImplementation((filter) => ({ lean: () => Promise.resolve(filter.code === 'unknown' ? null : { _id: 'st3', code: filter.code, group: 'work', actions: [] }) }));
    await expect(svc.changeOrderStatus({ orderId: global.__ORDER_HEX, newStatusCode: 'unknown', userId: global.__USER_HEX }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});