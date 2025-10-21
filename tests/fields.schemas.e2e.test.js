const request = require('supertest');
const express = require('express');

// Use DEV mode to hit in-memory branch
process.env.AUTH_DEV_MODE = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/fields', require('../routes/fields'));
  app.use(require('../middleware/error'));
  return app;
}

describe('FieldSchemas e2e (DEV)', () => {
  let app;
  beforeAll(() => {
    app = makeApp();
  });

  test('POST /api/fields — list/multilist must have options → 400 FIELD_OPTIONS_REQUIRED', async () => {
    const res = await request(app)
      .post('/api/fields')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'Admin')
      .send({ scope: 'orders', name: 'Форма заказа', fields: [{ code: 'brand', type: 'list' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('FIELD_OPTIONS_REQUIRED');
  });

  test('CRUD + versions + activate/deactivate + delete guard', async () => {
    const scope = 'orders';
    const name = 'Форма заказа';

    // 1) Create v1
    const createV1 = await request(app)
      .post('/api/fields')
      .set('x-user-id', 'uAdmin')
      .set('x-user-role', 'Admin')
      .send({
        scope,
        name,
        note: 'initial',
        fields: [
          { code: 'clientName', type: 'text', label: 'Client', required: true },
          { code: 'priority', type: 'list', label: 'Priority', options: ['low', 'medium', 'high'] },
        ],
      });
    expect(createV1.status).toBe(200);
    expect(createV1.body && createV1.body.ok).toBe(true);
    const v1 = createV1.body.item;
    expect(v1.version).toBe(1);
    expect(v1.isActive).toBe(true);

    // 2) Create v2 for same scope/name → v2 active, v1 inactive
    const createV2 = await request(app)
      .post('/api/fields')
      .set('x-user-id', 'uAdmin')
      .set('x-user-role', 'Admin')
      .send({
        scope,
        name,
        note: 'v2 note',
        fields: [
          { code: 'clientName', type: 'text', label: 'Client', required: true },
          { code: 'priority', type: 'list', label: 'Priority', options: ['low', 'medium', 'high'] },
          { code: 'deadline', type: 'date', label: 'Deadline' },
        ],
      });
    expect(createV2.status).toBe(200);
    const v2 = createV2.body.item;
    expect(v2.version).toBe(2);
    expect(v2.isActive).toBe(true);

    // 3) List versions by scope/name → [v2, v1]
    const versions = await request(app)
      .get(`/api/fields/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/versions`)
      .set('x-user-role', 'Admin');
    expect(versions.status).toBe(200);
    expect(versions.body && versions.body.ok).toBe(true);
    expect(Array.isArray(versions.body.items)).toBe(true);
    expect(versions.body.items[0].version).toBe(2);
    expect(versions.body.items[0].isActive).toBe(true);
    const v1Ref = versions.body.items.find((x) => x.version === 1);
    expect(v1Ref && v1Ref.isActive).toBe(false);

    // 4) GET by id
    const getV2 = await request(app)
      .get(`/api/fields/${v2._id}`)
      .set('x-user-role', 'Admin');
    expect(getV2.status).toBe(200);
    expect(getV2.body.item && getV2.body.item._id).toBe(v2._id);

    // 5) PATCH fields with invalid list → 400
    const badPatch = await request(app)
      .patch(`/api/fields/${v2._id}`)
      .set('x-user-role', 'Admin')
      .send({ fields: [{ code: 'priority', type: 'list' }] });
    expect(badPatch.status).toBe(400);
    expect(badPatch.body.error).toBe('FIELD_OPTIONS_REQUIRED');

    // 6) PATCH note ok
    const patchOk = await request(app)
      .patch(`/api/fields/${v2._id}`)
      .set('x-user-role', 'Admin')
      .send({ note: 'patched' });
    expect(patchOk.status).toBe(200);
    expect(patchOk.body.item.note).toBe('patched');

    // 7) Activate v1 back
    const activateV1 = await request(app)
      .post(`/api/fields/${v1._id}/activate`)
      .set('x-user-role', 'Admin');
    expect(activateV1.status).toBe(200);
    expect(activateV1.body.item.isActive).toBe(true);

    // 8) Deactivate v1
    const deactivateV1 = await request(app)
      .post(`/api/fields/${v1._id}/deactivate`)
      .set('x-user-role', 'Admin');
    expect(deactivateV1.status).toBe(200);
    expect(deactivateV1.body.item.isActive).toBe(false);

    // After deactivation, ensure v2 is active for delete-guard check
    const reactivateV2 = await request(app)
      .post(`/api/fields/${v2._id}/activate`)
      .set('x-user-role', 'Admin');
    expect(reactivateV2.status).toBe(200);
    expect(reactivateV2.body.item.isActive).toBe(true);

    // 9) DELETE active → 409, inactive → ok
    const curr = await request(app)
      .get(`/api/fields/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/versions`)
      .set('x-user-role', 'Admin');
    const active = curr.body.items.find((x) => x.isActive);

    // Delete active must fail
    const delActive = await request(app)
      .delete(`/api/fields/${active._id}`)
      .set('x-user-role', 'Admin');
    expect(delActive.status).toBe(409);
    expect(delActive.body.error).toBe('DELETE_ACTIVE_FORBIDDEN');

    // Delete inactive must pass
    const inactive = curr.body.items.find((x) => !x.isActive);
    const delInactive = await request(app)
      .delete(`/api/fields/${inactive._id}`)
      .set('x-user-role', 'Admin');
    expect(delInactive.status).toBe(200);
    expect(delInactive.body && delInactive.body.ok).toBe(true);
  });
});