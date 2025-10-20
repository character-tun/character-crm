const request = require('supertest');
const express = require('express');
const Joi = require('joi');

const {
  notifyTemplateSchema,
  docTemplateSchema,
  notifyTemplatesListResponseSchema,
  notifyTemplateItemResponseSchema,
  docTemplatesListResponseSchema,
  docTemplateItemResponseSchema,
} = require('../contracts/apiContracts');

function joiOk(schema, payload, { allowUnknown = true } = {}) {
  const { error } = schema.validate(payload, { allowUnknown });
  if (error) throw new Error(error.message);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  const { withUser } = require('../middleware/auth');
  app.use(withUser);
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  const errorHandler = require('../middleware/error');
  app.use(errorHandler);
  return app;
}

describe('API Contracts: Templates CRUD', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  describe('DEV branch', () => {
    let app;
    beforeEach(() => {
      process.env.AUTH_DEV_MODE = '1';
      jest.resetModules();

      // Stub OrderStatus.exists to undefined to trigger DEV fallback TEMPLATE_IN_USE
      jest.doMock(require.resolve('../models/OrderStatus'), () => ({
        exists: jest.fn().mockResolvedValue(undefined),
      }));

      app = makeApp();
    });

    test('Notify: list and create adhere to schema', async () => {
      const listRes = await request(app)
        .get('/api/notify/templates')
        .set('x-user-role', 'settings.notify:*')
        .expect(200);
      joiOk(notifyTemplatesListResponseSchema, listRes.body);

      const createRes = await request(app)
        .post('/api/notify/templates')
        .set('x-user-role', 'settings.notify:*')
        .send({
          code: 'order_created', name: 'Order Created', subject: 'Subject', bodyHtml: '<b>Hi</b>', variables: ['name'],
        })
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, createRes.body);

      const tpl = createRes.body.item;
      const getRes = await request(app)
        .get(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, getRes.body);

      const patchRes = await request(app)
        .patch(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .send({ name: 'Order Created v2' })
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, patchRes.body);

      const delForbidden = await request(app)
        .delete(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .expect(400);
      expect(delForbidden.body.error).toBe('TEMPLATE_IN_USE');
    });

    test('Doc: list/create/get/patch/delete adhere to schema', async () => {
      const listRes = await request(app)
        .get('/api/doc-templates')
        .set('x-user-role', 'settings.docs:*')
        .expect(200);
      joiOk(docTemplatesListResponseSchema, listRes.body);

      const createRes = await request(app)
        .post('/api/doc-templates')
        .set('x-user-role', 'settings.docs:*')
        .send({
          code: 'invoice', name: 'Invoice', bodyHtml: '<b>Invoice</b>', variables: ['orderId'],
        })
        .expect(200);
      joiOk(docTemplateItemResponseSchema, createRes.body);
      const tpl = createRes.body.item;

      const getRes = await request(app)
        .get(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .expect(200);
      joiOk(docTemplateItemResponseSchema, getRes.body);

      const patchRes = await request(app)
        .patch(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .send({ name: 'Invoice v2' })
        .expect(200);
      joiOk(docTemplateItemResponseSchema, patchRes.body);

      const delForbidden = await request(app)
        .delete(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .expect(400);
      expect(delForbidden.body.error).toBe('TEMPLATE_IN_USE');
    });
  });

  describe('Mongo branch', () => {
    let app;

    beforeEach(() => {
      jest.resetModules();
      process.env.AUTH_DEV_MODE = '0';

      const makeQuery = (value) => ({
        lean: () => Promise.resolve(value),
        then: (resolve) => Promise.resolve(resolve(value)),
      });

      // In-memory stub for NotifyTemplate model
      const notifyState = { items: [] };
      jest.doMock(require.resolve('../models/NotifyTemplate'), () => ({
        find() { return { lean: async () => notifyState.items.map((i) => ({ ...i })) }; },
        // findOne awaited directly in routes
        findOne({ code }) { return Promise.resolve(notifyState.items.find((i) => i.code === code) || null); },
        create(doc) {
          const item = { ...doc, _id: `nt_${Date.now()}` };
          notifyState.items.push(item);
          return item;
        },
        findById(id) { return makeQuery(notifyState.items.find((i) => i._id === id) || null); },
        findByIdAndUpdate(id, patch) {
          const idx = notifyState.items.findIndex((i) => i._id === id);
          const updated = idx === -1 ? null : { ...notifyState.items[idx], ...patch };
          if (idx !== -1) notifyState.items[idx] = updated;
          return makeQuery(updated);
        },
        deleteOne({ _id }) {
          const idx = notifyState.items.findIndex((i) => i._id === _id);
          if (idx === -1) return { deletedCount: 0 };
          notifyState.items.splice(idx, 1);
          return { deletedCount: 1 };
        },
      }));

      // In-memory stub for DocTemplate model
      const docState = { items: [] };
      jest.doMock(require.resolve('../models/DocTemplate'), () => ({
        find() { return { lean: async () => docState.items.map((i) => ({ ...i })) }; },
        // findOne awaited directly in routes
        findOne({ code }) { return Promise.resolve(docState.items.find((i) => i.code === code) || null); },
        create(doc) {
          const item = { ...doc, _id: `dt_${Date.now()}` };
          docState.items.push(item);
          return item;
        },
        findById(id) { return makeQuery(docState.items.find((i) => i._id === id) || null); },
        findByIdAndUpdate(id, patch) {
          const idx = docState.items.findIndex((i) => i._id === id);
          const updated = idx === -1 ? null : { ...docState.items[idx], ...patch };
          if (idx !== -1) docState.items[idx] = updated;
          return makeQuery(updated);
        },
        deleteOne({ _id }) {
          const idx = docState.items.findIndex((i) => i._id === _id);
          if (idx === -1) return { deletedCount: 0 };
          docState.items.splice(idx, 1);
          return { deletedCount: 1 };
        },
      }));

      // Stub OrderStatus.exists to avoid hanging Mongoose calls in Mongo branch
      jest.doMock(require.resolve('../models/OrderStatus'), () => ({
        exists: jest.fn().mockResolvedValue(false),
      }));

      app = makeApp();
    });

    test('Notify: list/create/get/patch/delete adhere to schema', async () => {
      const listRes = await request(app)
        .get('/api/notify/templates')
        .set('x-user-role', 'settings.notify:*')
        .expect(200);
      joiOk(notifyTemplatesListResponseSchema, listRes.body);

      const createRes = await request(app)
        .post('/api/notify/templates')
        .set('x-user-role', 'settings.notify:*')
        .send({
          code: 'promo', name: 'Promo', subject: 'S', bodyHtml: '<i>X</i>', variables: [],
        })
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, createRes.body);
      const tpl = createRes.body.item;

      const getRes = await request(app)
        .get(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, getRes.body);

      const patchRes = await request(app)
        .patch(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .send({ name: 'Promo v2' })
        .expect(200);
      joiOk(notifyTemplateItemResponseSchema, patchRes.body);

      const delRes = await request(app)
        .delete(`/api/notify/templates/${tpl._id}`)
        .set('x-user-role', 'settings.notify:*')
        .expect(200);
      expect(delRes.body && delRes.body.ok).toBe(true);
    });

    test('Doc: list/create/get/patch/delete adhere to schema', async () => {
      const listRes = await request(app)
        .get('/api/doc-templates')
        .set('x-user-role', 'settings.docs:*')
        .expect(200);
      joiOk(docTemplatesListResponseSchema, listRes.body);

      const createRes = await request(app)
        .post('/api/doc-templates')
        .set('x-user-role', 'settings.docs:*')
        .send({
          code: 'waybill', name: 'Waybill', bodyHtml: '<div/>', variables: ['orderId'],
        })
        .expect(200);
      joiOk(docTemplateItemResponseSchema, createRes.body);
      const tpl = createRes.body.item;

      const getRes = await request(app)
        .get(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .expect(200);
      joiOk(docTemplateItemResponseSchema, getRes.body);

      const patchRes = await request(app)
        .patch(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .send({ name: 'Waybill v2' })
        .expect(200);
      joiOk(docTemplateItemResponseSchema, patchRes.body);

      const delRes = await request(app)
        .delete(`/api/doc-templates/${tpl._id}`)
        .set('x-user-role', 'settings.docs:*')
        .expect(200);
      expect(delRes.body && delRes.body.ok).toBe(true);
    });
  });
});