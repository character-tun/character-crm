const request = require('supertest');
const express = require('express');

jest.mock('../models/OrderStatus', () => ({
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/Order', () => ({
  exists: jest.fn(),
}));

jest.mock('../services/statusDeletionGuard', () => ({
  isStatusInOrderTypes: jest.fn(),
}));

const OrderStatus = require('../models/OrderStatus');
const Order = require('../models/Order');
const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/statuses', require('../routes/statuses'));
  app.use(require('../middleware/error'));
  return app;
}

describe('DELETE /api/statuses/:id', () => {
  const STATUS_ID = 'st-1';
  const STATUS_DOC = { _id: STATUS_ID, code: 'in_work', system: false };

  beforeEach(() => {
    jest.clearAllMocks();
    OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(STATUS_DOC) });
    OrderStatus.findByIdAndDelete.mockReturnValue({ lean: jest.fn().mockResolvedValue(STATUS_DOC) });
    Order.exists.mockResolvedValue(null);
    isStatusInOrderTypes.mockResolvedValue(false);
  });

  test('returns 400 STATUS_IN_USE when orders exist', async () => {
    const app = makeApp();
    Order.exists.mockResolvedValue(true);

    const res = await request(app)
      .delete(`/api/statuses/${STATUS_ID}`)
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:delete');

    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('STATUS_IN_USE');
    expect(OrderStatus.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('returns 400 STATUS_IN_TYPES when hook says in types', async () => {
    const app = makeApp();
    isStatusInOrderTypes.mockResolvedValue(true);

    const res = await request(app)
      .delete(`/api/statuses/${STATUS_ID}`)
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:delete');

    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('STATUS_IN_TYPES');
    expect(OrderStatus.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('deletes when no orders and not in types', async () => {
    const app = makeApp();

    const res = await request(app)
      .delete(`/api/statuses/${STATUS_ID}`)
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:delete');

    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(OrderStatus.findByIdAndDelete).toHaveBeenCalledWith(STATUS_ID);
  });
});
