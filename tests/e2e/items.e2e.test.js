const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/items', require('../../routes/items'));
  app.use(require('../../middleware/error'));
  return app;
}

describe('Items (e2e): list/create/patch in DEV mode', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    app = makeApp();
  });

  test('create → list → patch', async () => {
    const headers = { 'x-user-role': 'Admin' };

    const createRes = await request(app)
      .post('/api/items')
      .set(headers)
      .send({ name: 'Shampoo X', price: 19.99, unit: 'pcs', sku: 'shx-001', tags: ['care'] });
    expect([200, 201]).toContain(createRes.statusCode);
    const createdId = createRes.body && (createRes.body.id || (createRes.body.item && createRes.body.item._id));
    expect(typeof createdId).toBe('string');

    const listRes = await request(app)
      .get('/api/items?q=Shampoo')
      .set(headers)
      .expect(200);
    const items = (listRes.body && listRes.body.items) || [];
    expect(Array.isArray(items)).toBe(true);
    const found = items.find((it) => String(it._id) === String(createdId));
    expect(found && found.name).toBe('Shampoo X');

    const patchRes = await request(app)
      .patch(`/api/items/${createdId}`)
      .set(headers)
      .send({ price: 21.49, note: 'new price' })
      .expect(200);
    const patched = patchRes.body && patchRes.body.item;
    expect(patched && patched.price).toBe(21.49);
    expect(patched && patched.note).toBe('new price');
  });
});
