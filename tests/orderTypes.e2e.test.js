const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

// Mock DB models used in DB branch
jest.mock('../server/models/OrderType', () => ({
  find: jest.fn(() => ({ populate: () => ({ lean: jest.fn().mockResolvedValue([]) }) })),
  findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, code: 'type-x', isSystem: false, allowedStatuses: [], startStatusId: undefined }) })),
  create: jest.fn(async (doc) => ({ ...doc, _id: `ot_${Date.now()}` })),
  findByIdAndUpdate: jest.fn(() => ({ populate: () => ({ lean: jest.fn().mockResolvedValue({ _id: 'ot_patch', code: 'type-patch' }) }) })),
  deleteOne: jest.fn(async () => ({ acknowledged: true, deletedCount: 1 })),
}));

// Mock OrderStatusLog to avoid mongoose model compilation
jest.mock('../models/OrderStatusLog', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/Order', () => ({
  exists: jest.fn(),
  create: jest.fn(async (doc) => ({ _id: `ord_${Date.now()}`, ...doc })),
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'ord_created', status: 'new', paymentsLocked: false }) })),
}));

jest.mock('../models/OrderStatus', () => ({
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ _id: 'st_new', code: 'new' }) })),
  findOne: jest.fn(),
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/order-types', require('../routes/orderTypes'));
  app.use('/api/orders', require('../routes/orders'));
  app.use(require('../middleware/error'));
  return app;
}

describe('API /api/order-types e2e (DB branch via mongoose ready)', () => {
  const OrderType = require('../server/models/OrderType');
  const Order = require('../models/Order');
  const OrderStatus = require('../models/OrderStatus');

  beforeEach(() => {
    jest.clearAllMocks();
    const mongoose = require('mongoose');
    mongoose.connection.readyState = 1; // force DB branch
  });

  test('DELETE system type → 409 SYSTEM_TYPE', async () => {
    OrderType.findById.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'ot_sys', code: 'sys', isSystem: true }) });
    const app = makeApp();
    const res = await request(app)
      .delete('/api/order-types/ot_sys')
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(409);
    expect(res.body && res.body.error).toBe('SYSTEM_TYPE');
  });

  test('DELETE type in use by orders → 409 ORDERTYPE_IN_USE', async () => {
    OrderType.findById.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'ot_use', code: 'type-use', isSystem: false }) });
    Order.exists.mockResolvedValueOnce(true);
    const app = makeApp();
    const res = await request(app)
      .delete('/api/order-types/ot_use')
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(409);
    expect(res.body && res.body.error).toBe('ORDERTYPE_IN_USE');
  });

  test('POST /api/orders with orderTypeId sets initial status from startStatusId', async () => {
    // OrderType with startStatusId and allowed list
    const type = { _id: 'ot_c1', allowedStatuses: ['st_new'], startStatusId: 'st_new' };
    OrderType.findById.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(type) });
    // OrderStatus.findById returns status { code: 'new' } already in mock
    const app = makeApp();
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'Admin')
      .send({ orderTypeId: 'ot_c1' });
    expect(res.status).toBe(201);
    expect(res.body && res.body.ok).toBe(true);
    expect(res.body && res.body.item && res.body.item.status).toBe('new');
  });

  test('PATCH /api/orders/:id/status to not-allowed → 409 STATUS_NOT_ALLOWED', async () => {
    // Mock order and status lookups inside service branch
    const mongoose = require('mongoose');
    mongoose.connection.readyState = 1;

    const OrderModel = require('../models/Order');
    OrderModel.findById.mockResolvedValue({ _id: 'ord_na', orderTypeId: 'ot_na', status: 'draft', save: jest.fn().mockResolvedValue(true) });

    const OrderStatusModel = require('../models/OrderStatus');
    OrderStatusModel.findOne
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ code: 'draft', group: 'draft', actions: [] }) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'st_other', code: 'in_work', group: 'in_progress', actions: [] }) });

    OrderType.findById.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'ot_na', allowedStatuses: ['st_allowed'] }) });

    const app = makeApp();
    const res = await request(app)
      .patch('/api/orders/ord_na/status')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', userId: 'u1' });

    expect(res.status).toBe(409);
    expect(res.body && res.body.error).toBe('STATUS_NOT_ALLOWED');
  });
});
