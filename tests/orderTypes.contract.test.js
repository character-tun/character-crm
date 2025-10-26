const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/order-types', require('../routes/orderTypes'));
  app.use(require('../middleware/error'));
  return app;
}

describe('API /api/order-types contracts (DEV mem branch)', () => {
  beforeEach(() => {
    jest.resetModules();
    const mongoose = require('mongoose');
    mongoose.connection.readyState = 0; // force DEV mem branch
  });

  test('POST invalid startStatusId not in allowed → 400 ORDERTYPE_INVALID_START_STATUS', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/order-types')
      .set('x-user-role', 'Admin')
      .send({ code: 'ot-a', name: 'Type A', startStatusId: 'st-x', allowedStatuses: ['st-a'] });
    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('ORDERTYPE_INVALID_START_STATUS');
  });

  test('CRUD happy path and code uniqueness', async () => {
    const app = makeApp();

    // Create
    let res = await request(app)
      .post('/api/order-types')
      .set('x-user-role', 'Admin')
      .send({ code: 'OT-1', name: 'Type 1', startStatusId: 'st-1', allowedStatuses: ['st-1', 'st-2'] });
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    const { item } = res.body;
    expect(item && item.code).toBe('ot-1'); // normalized to lowercase

    // Duplicate code (case-insensitive) → 409
    res = await request(app)
      .post('/api/order-types')
      .set('x-user-role', 'Admin')
      .send({ code: 'ot-1', name: 'Type 1 dup' });
    expect(res.status).toBe(409);
    expect(res.body && res.body.error).toBe('CODE_EXISTS');

    // List
    res = await request(app)
      .get('/api/order-types')
      .set('x-user-role', 'Manager');
    expect(res.status).toBe(200);
    expect(res.body && res.body.items && Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);

    // Get by id
    res = await request(app)
      .get(`/api/order-types/${item._id}`)
      .set('x-user-role', 'Manager');
    expect(res.status).toBe(200);
    expect(res.body && res.body.item && res.body.item._id).toBe(item._id);

    // Patch — changing allowed to exclude current start → 400
    res = await request(app)
      .patch(`/api/order-types/${item._id}`)
      .set('x-user-role', 'Admin')
      .send({ allowedStatuses: ['st-2'] });
    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('ORDERTYPE_INVALID_START_STATUS');
  });

  test('DELETE system type → 409 SYSTEM_TYPE', async () => {
    const app = makeApp();

    // Create system type
    let res = await request(app)
      .post('/api/order-types')
      .set('x-user-role', 'Admin')
      .send({ code: 'ot-sys', name: 'System type', isSystem: true });
    expect(res.status).toBe(200);
    const sys = res.body.item;

    // Try delete
    res = await request(app)
      .delete(`/api/order-types/${sys._id}`)
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(409);
    expect(res.body && res.body.error).toBe('SYSTEM_TYPE');
  });
});
