const request = require('supertest');
const express = require('express');

/**
 * Бизнес-правила блокировки платежей:
 * - Редактирование залоченного платежа → ошибка 403 PAYMENT_LOCKED
 * - payments.lock может лочить платеж
 */

describe('Payments Lock Rules e2e', () => {
  let app;
  beforeAll(() => {
    process.env.AUTH_DEV_MODE = '1';
    app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/payments', require('../routes/payments'));
    app.use(require('../middleware/error'));
  });

  test('lock then patch with Manager (no payments.write) → 403', async () => {
    const created = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId: 'lock-order-1' })
      .expect(200);
    const id = created.body.id;

    await request(app)
      .post(`/api/payments/${id}/lock`)
      .set('x-user-role', 'Finance')
      .expect(200);

    const res = await request(app)
      .patch(`/api/payments/${id}`)
      .set('x-user-role', 'Manager')
      .send({ note: 'should fail' })
      .expect(403);
    expect(res.body && (res.body.error || res.body.msg)).toBeTruthy();
  });

  test('lock then patch with Admin (has payments.lock) → 200', async () => {
    const created = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId: 'lock-order-2' })
      .expect(200);
    const id = created.body.id;

    await request(app)
      .post(`/api/payments/${id}/lock`)
      .set('x-user-role', 'Admin')
      .expect(200);

    const res = await request(app)
      .patch(`/api/payments/${id}`)
      .set('x-user-role', 'Admin')
      .send({ note: 'override by Admin' })
      .expect(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(res.body.item && res.body.item.note).toBe('override by Admin');
  });
});