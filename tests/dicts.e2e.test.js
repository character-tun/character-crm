const request = require('supertest');
const express = require('express');

process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/dicts', require('../routes/dicts'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Dictionaries e2e (DEV)', () => {
  let app;
  beforeAll(() => {
    app = makeApp();
  });

  test('CRUD flow + conflicts + get by code', async () => {
    // 1) list empty
    const list0 = await request(app)
      .get('/api/dicts')
      .set('x-user-role', 'Admin');
    expect(list0.status).toBe(200);
    expect(Array.isArray(list0.body.items)).toBe(true);

    // 2) create dict
    const create = await request(app)
      .post('/api/dicts')
      .set('x-user-id', 'uAdmin')
      .set('x-user-role', 'Admin')
      .send({ code: 'brands', name: 'Бренды', values: ['Nike', 'Adidas'] });
    expect(create.status).toBe(200);
    const dict = create.body.item;
    expect(dict.code).toBe('brands');

    // 3) conflict on duplicate code
    const dup = await request(app)
      .post('/api/dicts')
      .set('x-user-role', 'Admin')
      .send({ code: 'brands', name: 'Бренды 2', values: ['Puma'] });
    expect(dup.status).toBe(409);

    // 4) get by id
    const getById = await request(app)
      .get(`/api/dicts/${dict._id}`)
      .set('x-user-role', 'Admin');
    expect(getById.status).toBe(200);
    expect(getById.body.item._id).toBe(dict._id);

    // 5) get by code
    const getByCode = await request(app)
      .get('/api/dicts/by-code/brands')
      .set('x-user-role', 'Admin');
    expect(getByCode.status).toBe(200);
    expect(getByCode.body.item.code).toBe('brands');

    // 6) update
    const update = await request(app)
      .patch(`/api/dicts/${dict._id}`)
      .set('x-user-role', 'Admin')
      .send({ code: 'brands', name: 'БРЕНДЫ', values: ['Nike', 'Adidas', 'Puma'] });
    expect(update.status).toBe(200);
    expect(update.body.item.values).toContain('Puma');

    // 7) delete
    const del = await request(app)
      .delete(`/api/dicts/${dict._id}`)
      .set('x-user-role', 'Admin');
    expect(del.status).toBe(200);

    // 8) list empty again
    const list1 = await request(app)
      .get('/api/dicts')
      .set('x-user-role', 'Admin');
    expect(list1.status).toBe(200);
    expect(list1.body.items.find((x) => x._id === dict._id)).toBeUndefined();
  });
});
