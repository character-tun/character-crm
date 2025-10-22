/*
 E2E PROD-like: поступление товара → продажа → списание со склада → начисление сотруднику
 - DEV API для items/stock/payments
 - Статус-экшены выполняются через Mongo-подобные mock-модели (StockItem, StockMovement, PayrollAccrual, Order, OrderStatusLog)
*/

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

process.env.AUTH_DEV_MODE = '1';
process.env.PAYROLL_PERCENT = '0.1';

// In-memory stores for mocked Mongo models
const stockItemsMem = new Map();
const stockMovementsMem = [];
const accrualsMem = [];
const logsMem = [];
const orderState = { doc: null };

// Mongo-like mocks to drive statusActionsHandler's Mongo branch
jest.mock('../server/models/StockItem', () => {
  const stockItemsMem = new Map();
  class Doc {
    constructor(payload) {
      this._id = `si-${Date.now()}`;
      this.itemId = payload.itemId;
      this.qtyOnHand = payload.qtyOnHand || 0;
    }
    async save() {
      stockItemsMem.set(String(this.itemId), this);
      return this;
    }
  }
  return {
    async findOne(query) {
      return stockItemsMem.get(String(query.itemId)) || null;
    },
    async create(payload) {
      const doc = new Doc(payload);
      await doc.save();
      return doc;
    },
    __getQty: (itemId) => (stockItemsMem.get(String(itemId))?.qtyOnHand || 0),
    __seed: (itemId, qty) => stockItemsMem.set(String(itemId), {
      _id: `si-${Date.now()}`,
      itemId,
      qtyOnHand: qty,
      save: async function () { stockItemsMem.set(String(itemId), this); },
    }),
    __clear: () => stockItemsMem.clear(),
  };
});

jest.mock('../server/models/StockMovement', () => {
  const stockMovementsMem = [];
  return {
    async create(payload) { const doc = { _id: `sm-${Date.now()}`, ...payload }; stockMovementsMem.push(doc); return doc; },
    __getAll: () => stockMovementsMem.slice(),
    __clear: () => { stockMovementsMem.length = 0; },
  };
});

jest.mock('../server/models/PayrollAccrual', () => {
  const accrualsMem = [];
  return {
    async create(payload) { const doc = { _id: `pa-${Date.now()}`, ...payload }; accrualsMem.push(doc); return doc; },
    __getAll: () => accrualsMem.slice(),
    __clear: () => { accrualsMem.length = 0; },
  };
});

jest.mock('../models/OrderStatusLog', () => {
  const logsMem = [];
  return {
    async create(payload) { logsMem.push(payload); return { _id: `log-${Date.now()}` }; },
    __getAll: () => logsMem.slice(),
    __clear: () => { logsMem.length = 0; },
  };
});

jest.mock('../models/Order', () => {
  let stateDoc = null;
  return {
    __setOrder(doc) { stateDoc = doc; },
    __clear() { stateDoc = null; },
    findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(stateDoc ? { ...stateDoc, _id: id } : null) })),
  };
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/items', require('../routes/items'));
  app.use('/api/stock', require('../routes/stock'));
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

describe('e2e PROD-like: Stock → Shop → Staff', () => {
  beforeEach(() => {
    const StockItem = require('../server/models/StockItem');
    const StockMovement = require('../server/models/StockMovement');
    const PayrollAccrual = require('../server/models/PayrollAccrual');
    const OrderStatusLog = require('../models/OrderStatusLog');
    const Order = require('../models/Order');
    StockItem.__clear();
    StockMovement.__clear();
    PayrollAccrual.__clear();
    OrderStatusLog.__clear();
    Order.__clear();
    mongoose.connection.readyState = 0;
  });

  test('поступление → продажа → списание → начисление', async () => {
    const app = makeApp();

    // 1) Создаём товар
    let res = await request(app).post('/api/items')
      .set('x-user-role', 'Admin')
      .send({ name: 'Oil Cleaner', price: 200, unit: 'bottle', sku: 'OIL-001' });
    expect(res.status).toBe(200);
    const itemId = res.body.id;

    // 2) Поступление на склад: 3 шт
    res = await request(app).post('/api/stock/movements')
      .set('x-user-role', 'Admin')
      .send({ itemId, type: 'receipt', qty: 3, note: 'initial load', source: { kind: 'manual' } });
    expect(res.status).toBe(201);

    // Проверяем остаток = 3
    res = await request(app).get('/api/stock/items')
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(200);
    const list = res.body.items || [];
    const si = list.find((it) => String(it.itemId) === String(itemId));
    expect(si).toBeTruthy();
    expect(Number(si.qtyOnHand)).toBe(3);

    // 3) Продажа: регистрируем оплату заказа на 200
    const orderId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    res = await request(app).post('/api/payments')
      .set('x-user-role', 'Admin')
      .set('x-user-id', userId)
      .send({ orderId, type: 'income', amount: 200, articlePath: ['Продажи','Касса'] });
    expect(res.status).toBe(200);

    // 4) Переключаемся на Mongo-ветку для статус-экшенов и запускаем их
    mongoose.connection.readyState = 1; // включаем Mongo-путь в обработчике

    const { handleStatusActions } = require('../services/statusActionsHandler');
    const Order = require('../models/Order');
    const StockItem = require('../server/models/StockItem');
    // Seed: документ заказа и остаток по складу (3 шт)
    Order.__setOrder({
      items: [{ itemId, qty: 1, total: 200 }],
      totals: { subtotal: 200, discountTotal: 0, grandTotal: 200 },
      closed: { success: true, at: new Date() },
    });
    StockItem.__seed(itemId, 3);

    const logId = new mongoose.Types.ObjectId().toString();
    const r = await handleStatusActions({
      orderId,
      statusCode: 'closed_success',
      actions: ['stockIssue', { type: 'payrollAccrual', percent: 0.1 }],
      logId,
      userId,
    });
    expect(r && r.ok).toBe(true);
    expect(r.processed).toBe(2);

    // Проверяем списание со склада: остаток стал 2, есть движение issue
    const qtyAfter = StockItem.__getQty(itemId);
    expect(qtyAfter).toBe(2);
    const StockMovement = require('../server/models/StockMovement');
    const movementList = StockMovement.__getAll();
    expect(movementList.some(m => m.type === 'issue' && String(m.itemId) === String(itemId) && m.qty === -1)).toBe(true);

    // Проверяем начисление: 10% от 200 = 20
    const PayrollAccrual = require('../server/models/PayrollAccrual');
    const accList = PayrollAccrual.__getAll();
    expect(accList.length).toBe(1);
    const acc = accList[0];
    expect(Number(acc.amount)).toBe(20);
    expect(Number(acc.baseAmount)).toBe(200);
    expect(Number(acc.percent)).toBeCloseTo(0.1);

    // Проверяем аудит-лог
    const OrderStatusLog = require('../models/OrderStatusLog');
    const logList = OrderStatusLog.__getAll();
    expect(logList.some(l => l.note && l.note.includes('STATUS_ACTION_PAYROLL'))).toBe(true);
  });
});