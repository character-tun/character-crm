const mongoose = require('mongoose');

jest.mock('../models/Order', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/OrderStatus', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/OrderStatusLog', () => ({
  create: jest.fn(),
}));

jest.mock('../queues/statusActionQueue', () => ({
  enqueueStatusActions: jest.fn(),
}));

const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const OrderStatusLog = require('../models/OrderStatusLog');
const { enqueueStatusActions } = require('../queues/statusActionQueue');
const { changeOrderStatus } = require('../services/orderStatusService');

const USER_ID = new mongoose.Types.ObjectId().toString();
const ORDER_ID = new mongoose.Types.ObjectId().toString();

describe('changeOrderStatus orders.reopen permission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws 403 when reopening from closed_success without orders.reopen', async () => {
    const order = { status: 'done', save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(order);

    // Current status lookup: closed_success
    OrderStatus.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'done', group: 'closed_success', actions: [] }) }) // current status
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) }); // new status

    OrderStatusLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    enqueueStatusActions.mockResolvedValue(true);

    await expect(changeOrderStatus({ orderId: ORDER_ID, newStatusCode: 'in_work', userId: USER_ID, roles: [] }))
      .rejects.toMatchObject({ statusCode: 403, message: 'REOPEN_FORBIDDEN' });
  });

  test('passes when reopening from closed_fail with orders.reopen', async () => {
    const order = { status: 'cancelled', save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(order);

    // Current status lookup: closed_fail
    OrderStatus.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'cancelled', group: 'closed_fail', actions: [] }) }) // current status
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) }); // new status

    OrderStatusLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    enqueueStatusActions.mockResolvedValue(true);

    const res = await changeOrderStatus({ orderId: ORDER_ID, newStatusCode: 'in_work', userId: USER_ID, roles: ['orders.reopen'] });
    expect(res).toEqual({ ok: true });
  });

  test('passes when current status is not closed_* without orders.reopen', async () => {
    const order = { status: 'in_work', save: jest.fn().mockResolvedValue(true) };
    Order.findById.mockResolvedValue(order);

    OrderStatus.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [] }) }) // current status
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'done', group: 'closed_success', actions: [] }) }); // new status (closing)

    OrderStatusLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    enqueueStatusActions.mockResolvedValue(true);

    const res = await changeOrderStatus({ orderId: ORDER_ID, newStatusCode: 'done', userId: USER_ID, roles: [] });
    expect(res).toEqual({ ok: true });
  });
});