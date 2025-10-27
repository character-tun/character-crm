const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/orders', require('../../routes/orders'));
  app.use(require('../../middleware/error'));
  return app;
}

// Helper: mock mongoose session for transactions used in stockService.issueFromOrder
function mockMongooseSession() {
  const session = {
    async startTransaction() { this._started = true; },
    async commitTransaction() { this._committed = true; },
    async abortTransaction() { this._aborted = true; },
    endSession() { this._ended = true; },
  };
  mongoose.startSession = jest.fn(async () => session);
  return session;
}

// Mocks for models used by stockService.issueFromOrder
const StockStore = new Map(); // key: `${itemId}:${locationId}` -> quantity

const OrderMock = {
  findById: jest.fn((id) => ({
    _id: id,
    status: 'in_work',
    items: [{ itemId: global.__ITEM_ID, qty: 2 }],
    save: jest.fn().mockResolvedValue(true),
    lean: jest.fn().mockResolvedValue({ _id: id, items: [{ itemId: global.__ITEM_ID, qty: 2 }] }),
  })),
};
const OrderStatusMock = {
  findOne: jest.fn((q) => ({ lean: jest.fn().mockResolvedValue({ code: q.code, group: q.code === 'closed_paid' ? 'closed_success' : 'in_progress', actions: ['stockIssue'] }) })),
};
const StockBalanceMock = {
  findOne: jest.fn(({ itemId, locationId }) => ({
    session: async () => {
      const key = `${String(itemId)}:${String(locationId)}`;
      const qty = StockStore.get(key) ?? 10;
      return { itemId, locationId, quantity: qty };
    },
  })),
  updateOne: jest.fn(async (filter, update) => {
    const key = `${String(filter.itemId)}:${String(filter.locationId)}`;
    const cur = StockStore.get(key) ?? 0;
    const inc = update && update.$inc && typeof update.$inc.quantity === 'number' ? update.$inc.quantity : 0;
    StockStore.set(key, cur + inc);
    return { acknowledged: true };
  }),
};
const StockOperationMock = {
  findOne: jest.fn((q) => ({ session: async () => null })),
  create: jest.fn(async (docs) => docs),
};
jest.doMock('../../models/OrderStatusLog', () => ({ create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })) }));

jest.doMock('../../models/Order', () => OrderMock);
jest.doMock('../../models/OrderStatus', () => OrderStatusMock);
jest.doMock('../../models/stock/StockBalance', () => StockBalanceMock);
jest.doMock('../../models/stock/StockOperation', () => StockOperationMock);
jest.doMock('../../queues/statusActionQueue', () => {
  const stockService = require('../../services/stock/stockService');
  return {
    enqueueStatusActions: async ({ orderId, statusCode, actions, logId, userId }) => {
      if (Array.isArray(actions) && actions.includes('stockIssue')) {
        await stockService.issueFromOrder({ orderId, performedBy: userId });
      }
      return { ok: true };
    },
  };
});

const stockService = require('../../services/stock/stockService');

describe('E2E: Order Close -> V2 Stock Issue', () => {
  let app;
  const orderId = new mongoose.Types.ObjectId().toHexString();
  const itemId = new mongoose.Types.ObjectId().toHexString();
  const locationId = new mongoose.Types.ObjectId().toHexString();
  const userId = new mongoose.Types.ObjectId().toHexString();

  beforeAll(() => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.ENABLE_STOCKS_V2 = '1';
    process.env.ENABLE_STATUS_QUEUE = '0'; // inline processing in tests
    process.env.DEFAULT_STOCK_LOCATION_ID = locationId;

    global.__ITEM_ID = itemId;

    app = makeApp();
  });

  afterAll(() => {
    delete process.env.AUTH_DEV_MODE;
    delete process.env.ENABLE_STOCKS_V2;
    delete process.env.ENABLE_STATUS_QUEUE;
    delete process.env.DEFAULT_STOCK_LOCATION_ID;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    mockMongooseSession();
    StockStore.clear();
    StockStore.set(`${String(itemId)}:${String(locationId)}`, 10);
  });

  test('calls V2 stock issue and decrements balance', async () => {
    // no spy; we assert V2-specific model calls

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'closed_paid' });

    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);

    // Verify that StockOperation.create was attempted and StockBalance.update was invoked with decrement
    expect(StockOperationMock.create).toHaveBeenCalledTimes(1);
    expect(StockBalanceMock.updateOne).toHaveBeenCalledTimes(1);

    // Ensure quantity decreased by 2 at the default location
    const key = `${String(itemId)}:${String(locationId)}`;
    const finalQty = StockStore.get(key);
    expect(finalQty).toBe(8); // started 10, -2 issued
  });
});