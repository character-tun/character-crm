const mongoose = require('mongoose');

describe('orderStatusService changeOrderStatus (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
  });

  test('adds stockIssue to actions for closed_success group when missing', async () => {
    const enqueueStatusActions = jest.fn(async () => ({ ok: true }));
    jest.doMock('../queues/statusActionQueue', () => ({ enqueueStatusActions }));

    const OrderStatusLogCreate = jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() }));
    jest.doMock('../models/OrderStatusLog', () => ({ create: OrderStatusLogCreate }));

    const OrderStatus = { findOne: jest.fn() };
    jest.doMock('../models/OrderStatus', () => OrderStatus);

    OrderStatus.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'closed_paid', group: 'closed_success', actions: [] }) });

    jest.doMock('../models/Order', () => ({
      findById: jest.fn(async (id) => ({ _id: id, status: 'in_work', save: jest.fn().mockResolvedValue(true) })),
      updateOne: jest.fn(async () => ({ acknowledged: true })),
    }));

    const { changeOrderStatus } = require('../services/orderStatusService');

    const r = await changeOrderStatus({ orderId: '000000000000000000000011', newStatusCode: 'closed_paid', note: 'done', userId: '000000000000000000000001' });
    expect(r && r.ok).toBe(true);

    expect(enqueueStatusActions).toHaveBeenCalledTimes(1);
    const args = enqueueStatusActions.mock.calls[0][0];
    expect(args.actions.includes('stockIssue')).toBe(true);

    const logPayload = OrderStatusLogCreate.mock.calls[0][0];
    expect(Array.isArray(logPayload.actionsEnqueued)).toBe(true);
    expect(logPayload.actionsEnqueued.includes('stockIssue')).toBe(true);
  });

  test('does not duplicate stockIssue when already present', async () => {
    const enqueueStatusActions = jest.fn(async () => ({ ok: true }));
    jest.doMock('../queues/statusActionQueue', () => ({ enqueueStatusActions }));

    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })) }));

    const OrderStatus2 = { findOne: jest.fn() };
    jest.doMock('../models/OrderStatus', () => OrderStatus2);

    OrderStatus2.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'closed_paid', group: 'closed_success', actions: ['stockIssue'] }) });

    jest.doMock('../models/Order', () => ({
      findById: jest.fn(async (id) => ({ _id: id, status: 'in_work', save: jest.fn().mockResolvedValue(true) })),
      updateOne: jest.fn(async () => ({ acknowledged: true })),
    }));

    const { changeOrderStatus } = require('../services/orderStatusService');

    const r = await changeOrderStatus({ orderId: '000000000000000000000012', newStatusCode: 'closed_paid', userId: '000000000000000000000002' });
    expect(r && r.ok).toBe(true);

    const args = enqueueStatusActions.mock.calls[0][0];
    const count = args.actions.filter((a) => a === 'stockIssue').length;
    expect(count).toBe(1);
  });

  test('does not add stockIssue for non closed_success statuses', async () => {
    const enqueueStatusActions = jest.fn(async () => ({ ok: true }));
    jest.doMock('../queues/statusActionQueue', () => ({ enqueueStatusActions }));

    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })) }));

    const OrderStatus3 = { findOne: jest.fn() };
    jest.doMock('../models/OrderStatus', () => OrderStatus3);

    OrderStatus3.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'draft', group: 'in_progress', actions: [] }) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) });

    jest.doMock('../models/Order', () => ({
      findById: jest.fn(async (id) => ({ _id: id, status: 'draft', save: jest.fn().mockResolvedValue(true) })),
      updateOne: jest.fn(async () => ({ acknowledged: true })),
    }));

    const { changeOrderStatus } = require('../services/orderStatusService');

    const r = await changeOrderStatus({ orderId: '000000000000000000000013', newStatusCode: 'in_work', userId: '000000000000000000000003' });
    expect(r && r.ok).toBe(true);

    const args = enqueueStatusActions.mock.calls[0][0];
    expect(args.actions.includes('stockIssue')).toBe(false);
  });
});
