const mongoose = require('mongoose');

describe('statusActionsHandler.issueStockFromOrder (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.ENABLE_QUEUE_LOGS = '0';
    mongoose.connection = { readyState: 1 };
  });

  test('idempotency: second stockIssue does not double-decrement or duplicate movement', async () => {
    jest.mock('../models/Order', () => ({
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue({ _id: id, items: [{ itemId: 'SKU-X', qty: 3 }] }),
      })),
    }));

    // Mock StockItem with memory store per item
    jest.mock('../server/models/StockItem', () => {
      const store = new Map();
      function docFor(itemId) {
        return {
          _id: `si-${itemId}`,
          itemId,
          qtyOnHand: store.get(itemId)?.qtyOnHand || 10,
          async save() { store.set(itemId, { qtyOnHand: this.qtyOnHand }); },
        };
      }
      return {
        findOne: jest.fn(async ({ itemId }) => {
          const has = store.has(itemId);
          if (!has) return null;
          const base = docFor(itemId);
          return { ...base, async save() { store.set(itemId, { qtyOnHand: this.qtyOnHand }); } };
        }),
        create: jest.fn(async ({ itemId, qtyOnHand = 0 }) => {
          store.set(itemId, { qtyOnHand });
          return docFor(itemId);
        }),
        __getQty: (itemId) => store.get(itemId)?.qtyOnHand || 0,
      };
    });

    // Mock StockMovement with list + find().lean()
    jest.mock('../server/models/StockMovement', () => {
      const list = [];
      return {
        create: jest.fn(async (payload) => { const mv = { _id: `sm-${Date.now()}`, ...payload }; list.push(mv); return mv; }),
        find: jest.fn(() => ({
          lean: async () => list.slice(),
        })),
        __all: () => list.slice(),
      };
    });

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const orderId = new mongoose.Types.ObjectId().toHexString();
    const userId = new mongoose.Types.ObjectId().toHexString();

    const run = async () => handleStatusActions({
      orderId,
      statusCode: 'closed_paid',
      actions: ['stockIssue'],
      logId: 'log-1',
      userId,
    });

    const StockItem = require('../server/models/StockItem');
    const StockMovement = require('../server/models/StockMovement');

    // Seed item with qtyOnHand=10
    await StockItem.create({ itemId: 'SKU-X', qtyOnHand: 10 });

    const r1 = await run();
    expect(r1 && r1.ok).toBe(true);
    expect(StockItem.__getQty('SKU-X')).toBe(7); // 10 - 3
    expect(StockMovement.__all().filter(m => m.type === 'issue').length).toBe(1);

    const r2 = await run();
    expect(r2 && r2.ok).toBe(true);
    expect(StockItem.__getQty('SKU-X')).toBe(7); // unchanged due to idempotency
    expect(StockMovement.__all().filter(m => m.type === 'issue').length).toBe(1); // still one movement
  });

  test('creates StockItem when missing, decrements correctly, records movement payload', async () => {
    jest.mock('../models/Order', () => ({
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue({ _id: id, items: [{ itemId: 'SKU-Y', qty: 2 }] }),
      })),
    }));

    jest.mock('../server/models/StockItem', () => {
      const store = new Map();
      return {
        findOne: jest.fn(async ({ itemId }) => {
          const v = store.get(itemId);
          if (!v) return null;
          return { _id: `si-${itemId}`, itemId, qtyOnHand: v.qtyOnHand, async save() { store.set(itemId, { qtyOnHand: this.qtyOnHand }); } };
        }),
        create: jest.fn(async ({ itemId, qtyOnHand = 0 }) => {
          store.set(itemId, { qtyOnHand });
          return { _id: `si-${itemId}`, itemId, qtyOnHand, async save() { store.set(itemId, { qtyOnHand: this.qtyOnHand }); } };
        }),
        __getQty: (itemId) => store.get(itemId)?.qtyOnHand || 0,
      };
    });

    jest.mock('../server/models/StockMovement', () => {
      const list = [];
      return {
        create: jest.fn(async (payload) => { const mv = { _id: `sm-${Date.now()}`, ...payload }; list.push(mv); return mv; }),
        find: jest.fn(() => ({ lean: async () => list.slice() })),
        __all: () => list.slice(),
      };
    });

    const { handleStatusActions } = require('../services/statusActionsHandler');
    const orderId = new mongoose.Types.ObjectId().toHexString();
    const userId = new mongoose.Types.ObjectId().toHexString();

    const StockItem = require('../server/models/StockItem');
    const StockMovement = require('../server/models/StockMovement');

    // No seed; findOne will return null to force create
    const r = await handleStatusActions({ orderId, statusCode: 'closed_paid', actions: ['stockIssue'], logId: 'log-2', userId });
    expect(r && r.ok).toBe(true);
    expect(StockItem.__getQty('SKU-Y')).toBe(-2); // created at 0 then decrement by 2
    const mv = StockMovement.__all().find(m => m.type === 'issue');
    expect(mv).toBeTruthy();
    expect(String(mv.itemId)).toBe('SKU-Y');
    expect(Number(mv.qty)).toBe(-2);
    expect(mv.source && mv.source.kind).toBe('order');
    expect(String(mv.source.id)).toBe(String(orderId));
  });

  test('skips gracefully when DB not ready and models not mocked', async () => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    mongoose.connection = { readyState: 0 }; // DB not ready

    // Do NOT mock stock models; use real ones so model functions are not jest mocks
    jest.mock('../models/Order', () => ({
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, items: [{ itemId: 'SKU-Z', qty: 1 }] }) })),
    }));

    const { handleStatusActions } = require('../services/statusActionsHandler');
    const orderId = new mongoose.Types.ObjectId().toHexString();


    const r = await handleStatusActions({ orderId, statusCode: 'closed_paid', actions: ['stockIssue'], logId: 'log-3', userId: new mongoose.Types.ObjectId().toHexString() });
    expect(r && r.ok).toBe(true);
    // processed will include stockIssue action but adapter returns skipped path; we only assert ok
  });
});