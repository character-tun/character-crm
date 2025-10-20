const request = require('supertest');
const express = require('express');

// Force DEV mode to avoid Mongo dependency in routes that support it
process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);

  // Mount only the routes needed for RBAC checks
  app.use('/api/statuses', require('../routes/statuses'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/queue', require('../routes/queue'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/files', require('../routes/files'));

  app.use(require('../middleware/error'));
  return app;
}

/**
 * RBAC e2e checks:
 * - without role → 403
 * - with role → 200 (or 201 for creates)
 * - focus on endpoints that have explicit route-level RBAC
 */

describe('RBAC e2e', () => {
  let app;
  beforeAll(() => {
    app = makeApp();
  });

  test('GET /api/statuses without role → 403', async () => {
    const res = await request(app).get('/api/statuses');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/statuses with settings.statuses:list → 200', async () => {
    const res = await request(app)
      .get('/api/statuses')
      .set('x-user-role', 'settings.statuses:list');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/doc-templates without role → 403', async () => {
    const res = await request(app)
      .post('/api/doc-templates')
      .send({ code: 'test_tpl', name: 'Test', bodyHtml: '<div>Hi</div>' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/doc-templates with settings.docs:* → 200', async () => {
    const res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({ code: 'tpl_rbac', name: 'RBAC', bodyHtml: '<div>RBAC</div>' });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body && res.body.ok).toBe(true);
  });

  test('POST /api/notify/templates without role → 403', async () => {
    const res = await request(app)
      .post('/api/notify/templates')
      .send({
        code: 'test_ntpl', name: 'Test', subject: 'S', bodyHtml: '<b>Hi</b>',
      });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/notify/templates with settings.notify:* → 200', async () => {
    const res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: 'ntpl_rbac', name: 'RBAC', subject: 'RBAC', bodyHtml: '<b>RBAC OK</b>',
      });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body && res.body.ok).toBe(true);
  });

  test('GET /api/queue/status-actions/metrics without role → 403', async () => {
    const res = await request(app).get('/api/queue/status-actions/metrics');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/queue/status-actions/metrics with Admin → 200', async () => {
    const res = await request(app)
      .get('/api/queue/status-actions/metrics')
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(res.body && typeof res.body === 'object').toBe(true);
    // response is metrics object without {ok} wrapper
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('waiting');
    expect(res.body).toHaveProperty('delayed');
    expect(res.body).toHaveProperty('failedLastN');
    expect(res.body).toHaveProperty('failed24h');
    expect(res.body).toHaveProperty('processed24h');
    expect(res.body).toHaveProperty('failedLastHour');
  });

  test('PATCH /api/orders/:id/status without role → 403', async () => {
    const res = await request(app)
      .patch('/api/orders/ORDER-1/status')
      .set('x-user-id', 'U-1')
      .send({ newStatusCode: 'in_work' });
    expect(res.statusCode).toBe(403);
  });

  test('PATCH /api/orders/:id/status with orders.changeStatus → 200', async () => {
    const res = await request(app)
      .patch('/api/orders/ORDER-2/status')
      .set('x-user-id', 'U-2')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work' });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });

  test('GET /api/orders/:id/files without role → 403', async () => {
    const res = await request(app)
      .get('/api/orders/ORDER-3/files');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/orders/:id/files with docs.print → 200 and returns {ok:true}', async () => {
    const res = await request(app)
      .get('/api/orders/ORDER-4/files')
      .set('x-user-role', 'docs.print');
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
  });
});

describe('RBAC e2e — Users, Roles, Payments', () => {
  let app;
  beforeAll(() => {
    const express = require('express');
    app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/users', require('../routes/users'));
    app.use('/api/roles', require('../routes/roles'));
    app.use('/api/payments', require('../routes/payments'));
    app.use(require('../middleware/error'));
  });

  // Users
  test('GET /api/users without role → 403', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/users with Admin → 200', async () => {
    const res = await request(app).get('/api/users').set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/users without role → 403', async () => {
    const res = await request(app).post('/api/users').send({ email: 'u1@example.com' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/users with Admin → 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('x-user-role', 'Admin')
      .send({ email: 'admin-created@example.com', full_name: 'Admin Created' });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body && res.body.email).toBe('admin-created@example.com');
  });

  test('PUT /api/users/:id without role → 403', async () => {
    const res = await request(app).put('/api/users/U-999').send({ full_name: 'X' });
    expect(res.statusCode).toBe(403);
  });

  test('PUT /api/users/:id with Admin → 200', async () => {
    // Create then update
    const created = await request(app)
      .post('/api/users')
      .set('x-user-role', 'Admin')
      .send({ email: 'admin-update@example.com', full_name: 'To Update' });
    const id = created.body._id;
    const res = await request(app)
      .put(`/api/users/${id}`)
      .set('x-user-role', 'Admin')
      .send({ full_name: 'Updated Name' });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.full_name).toBe('Updated Name');
  });

  test('DELETE /api/users/:id without role → 403', async () => {
    const res = await request(app).delete('/api/users/U-100');
    expect(res.statusCode).toBe(403);
  });

  test('DELETE /api/users/:id with Admin → 200', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('x-user-role', 'Admin')
      .send({ email: 'admin-delete@example.com' });
    const id = created.body._id;
    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });

  // Roles
  test('GET /api/roles without role → 403', async () => {
    const res = await request(app).get('/api/roles');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/roles with Admin → 200', async () => {
    const res = await request(app).get('/api/roles').set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/roles without role → 403', async () => {
    const res = await request(app).post('/api/roles').send({ code: 'RBAC_TEST', name: 'RBAC Тест' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/roles with Admin → 201', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set('x-user-role', 'Admin')
      .send({ code: 'RBAC_OK', name: 'RBAC Ok' });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body && res.body.code).toBe('RBAC_OK');
  });

  test('PUT /api/roles/:id without role → 403', async () => {
    const res = await request(app).put('/api/roles/R-404').send({ name: 'X' });
    expect(res.statusCode).toBe(403);
  });

  test('PUT /api/roles/:id with Admin → 200', async () => {
    const created = await request(app)
      .post('/api/roles')
      .set('x-user-role', 'Admin')
      .send({ code: 'RBAC_UPD', name: 'To update' });
    const id = created.body._id;
    const res = await request(app)
      .put(`/api/roles/${id}`)
      .set('x-user-role', 'Admin')
      .send({ name: 'Updated' });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.name).toBe('Updated');
  });

  test('DELETE /api/roles/:id without role → 403', async () => {
    const res = await request(app).delete('/api/roles/R-100');
    expect(res.statusCode).toBe(403);
  });

  test('DELETE /api/roles/:id with Admin → 200', async () => {
    const created = await request(app)
      .post('/api/roles')
      .set('x-user-role', 'Admin')
      .send({ code: 'RBAC_DEL', name: 'To delete' });
    const id = created.body._id;
    const res = await request(app)
      .delete(`/api/roles/${id}`)
      .set('x-user-role', 'Admin');
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });

  // Payments
  test('POST /api/payments without role → 403', async () => {
    const res = await request(app).post('/api/payments').send({ orderId: 'ord-e2e-1' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/payments with Finance → 200', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('x-user-role', 'Finance')
      .send({ orderId: 'ord-e2e-2' });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });

  test('POST /api/payments/refund without role → 403', async () => {
    const res = await request(app).post('/api/payments/refund').send({ orderId: 'ord-e2e-3' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/payments/refund with Admin → 200', async () => {
    const res = await request(app)
      .post('/api/payments/refund')
      .set('x-user-role', 'Admin')
      .send({ orderId: 'ord-e2e-4' });
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });
});