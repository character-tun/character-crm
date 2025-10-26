const request = require('supertest');
const express = require('express');

// Use DEV mode fallback for Clients (routes support in-memory store in AUTH_DEV_MODE)
process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/clients', require('../routes/clients'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Clients API e2e — CRUD in DEV mode', () => {
  let app;
  beforeAll(() => {
    app = makeApp();
  });

  test('GET /api/clients without permission → 403', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/clients with clients.read → 200 and returns items', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-user-role', 'Manager');
    expect(res.statusCode).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('POST → GET by id → PUT → DELETE flow with clients.write', async () => {
    // Create
    const createdRes = await request(app)
      .post('/api/clients')
      .set('x-user-role', 'Manager')
      .send({
        name: 'Тест Клиент',
        phone: '+7 900 000-00-00',
        telegram: '@testclient',
        city: 'Казань',
        vehicle: 'SUV',
        tags: ['VIP'],
        notes: 'Создан в e2e',
      });
    expect([200, 201]).toContain(createdRes.statusCode);
    expect(createdRes.body && createdRes.body._id).toBeTruthy();
    const id = createdRes.body._id;

    // Get by id
    const getRes = await request(app)
      .get(`/api/clients/${id}`)
      .set('x-user-role', 'Manager');
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body && getRes.body._id).toBe(id);
    expect(getRes.body && getRes.body.name).toBe('Тест Клиент');

    // Update
    const updRes = await request(app)
      .put(`/api/clients/${id}`)
      .set('x-user-role', 'Manager')
      .send({ city: 'Новосибирск', tags: ['VIP', 'Лояльный'] });
    expect(updRes.statusCode).toBe(200);
    expect(updRes.body && updRes.body.city).toBe('Новосибирск');
    expect(Array.isArray(updRes.body && updRes.body.tags)).toBe(true);

    // Delete
    const delRes = await request(app)
      .delete(`/api/clients/${id}`)
      .set('x-user-role', 'Manager');
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body && delRes.body.ok).toBe(true);

    // Verify deleted
    const get404Res = await request(app)
      .get(`/api/clients/${id}`)
      .set('x-user-role', 'Manager');
    expect(get404Res.statusCode).toBe(404);
  });
});
