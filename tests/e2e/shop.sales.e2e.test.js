const request = require('supertest');
const express = require('express');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/shop', require('../../routes/shop'));
  app.use('/api/payments', require('../../routes/payments'));
  app.use(require('../../middleware/error'));
  return app;
}

describe('Shop sales e2e: list/create/get/refund', () => {
  const originalEnv = { ...process.env };
  let app;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.AUTH_DEV_MODE = '1';
    app = makeApp();
  });

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('create sale → 201 and id is returned', async () => {
    const res = await request(app)
      .post('/api/shop/sales')
      .set('x-user-id', 'user-1')
      .set('x-user-role', 'Admin')
      .send({
        items: [
          { name: 'Towel', price: 100, qty: 2 },
        ],
        method: 'cash',
        cashRegisterId: 'dev-main',
        note: 'e2e test sale',
        locationId: 'loc-1',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body && res.body.ok).toBe(true);
    expect(typeof res.body.id).toBe('string');
    // keep id for later
    const saleId = res.body.id;

    // list includes created sale
    const list = await request(app)
      .get('/api/shop/sales')
      .set('x-user-role', 'Admin');
    expect(list.statusCode).toBe(200);
    expect(list.body && list.body.ok).toBe(true);
    expect(Array.isArray(list.body.items)).toBe(true);
    const found = (list.body.items || []).find((it) => String(it._id) === String(saleId));
    expect(found).toBeTruthy();

    // get sale by id
    const getRes = await request(app)
      .get(`/api/shop/sales/${saleId}`)
      .set('x-user-role', 'Admin');
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body && getRes.body.ok).toBe(true);
    expect(getRes.body.item && Array.isArray(getRes.body.item.items)).toBe(true);
    expect(getRes.body.item.items.length).toBe(1);
    expect(getRes.body.item.totals && getRes.body.item.totals.grandTotal).toBe(200);

    // refund part of the sale
    const refund = await request(app)
      .post(`/api/shop/sales/${saleId}/refund`)
      .set('x-user-id', 'user-1')
      .set('x-user-role', 'Admin')
      .send({ amount: 50, reason: 'Customer returned one piece' });
    expect(refund.statusCode).toBe(200);
    expect(refund.body && refund.body.ok).toBe(true);

    // verify refund recorded on sale
    const getAfterRefund = await request(app)
      .get(`/api/shop/sales/${saleId}`)
      .set('x-user-role', 'Admin');
    expect(getAfterRefund.statusCode).toBe(200);
    expect(getAfterRefund.body && getAfterRefund.body.ok).toBe(true);
    const sale = getAfterRefund.body.item;
    expect(Array.isArray(sale.refunds)).toBe(true);
    expect(sale.refunds.length).toBe(1);
    expect(sale.refunds[0].amount).toBe(50);

    // optional: verify payments store contains income and refund linked to sale
    const payments = await request(app)
      .get(`/api/payments?orderId=${encodeURIComponent(saleId)}`)
      .set('x-user-role', 'Admin');
    expect(payments.statusCode).toBe(200);
    expect(payments.body && payments.body.ok).toBe(true);
    const items = payments.body.items || [];
    const income = items.find((p) => p.type === 'income');
    const refundItem = items.find((p) => p.type === 'refund');
    expect(income && income.amount).toBe(200);
    expect(refundItem && refundItem.amount).toBe(50);
  });
});
