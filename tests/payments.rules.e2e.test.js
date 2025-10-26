const request = require('supertest');
const express = require('express');

// Ensure DEV mode so payments route uses in-memory branch when Mongo not connected
process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/payments', require('../routes/payments'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Payments Business Rules (refund/lock)', () => {
  test('refund creates type=refund; totals reflect negative effect', async () => {
    const app = makeApp();
    const orderId = 'ord-rules-1';

    // Create income 200
    let res = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, type: 'income', amount: 200 })
      .expect(200);
    expect(res.body && res.body.id).toBeTruthy();

    // Refund 50
    res = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Finance')
      .send({ orderId, amount: 50 })
      .expect(200);
    expect(res.body && res.body.id).toBeTruthy();

    // List by order and check totals/items
    res = await request(app)
      .get(`/api/payments?orderId=${orderId}`)
      .set('x-user-role', 'Finance')
      .expect(200);

    const { items, totals } = res.body;
    expect(Array.isArray(items)).toBe(true);
    const refundItems = items.filter((i) => i.type === 'refund');
    expect(refundItems.length).toBe(1);
    expect(totals && totals.income).toBe(200);
    expect(totals && totals.refund).toBe(50);
    expect(totals && totals.balance).toBe(150);
  });

  test('PATCH cannot change locked via payload; lock endpoint works', async () => {
    const app = makeApp();
    const orderId = 'ord-rules-2';

    // Create payment
    let res = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId, type: 'income', amount: 100 })
      .expect(200);
    const { id } = res.body;

    // Attempt to set locked via PATCH → 400 VALIDATION_ERROR
    res = await request(app)
      .patch(`/api/payments/${id}`)
      .set('x-user-role', 'Finance')
      .send({ locked: true })
      .expect(400);
    expect((res.body && res.body.error) || res.body.msg).toBeTruthy();

    // Lock via dedicated endpoint → 200 and item.locked=true
    res = await request(app)
      .post(`/api/payments/${id}/lock`)
      .set('x-user-role', 'Finance')
      .expect(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(res.body && res.body.item && res.body.item.locked).toBe(true);
  });
});
