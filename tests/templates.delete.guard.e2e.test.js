const request = require('supertest');
const express = require('express');

jest.mock('../models/OrderStatus', () => ({
  exists: jest.fn(),
}));

const OrderStatus = require('../models/OrderStatus');

describe('e2e: deletion guards for templates when referenced by OrderStatus.actions', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/notify/templates', require('../routes/notifyTemplates'));
    app.use('/api/doc-templates', require('../routes/docTemplates'));
    app.use(require('../middleware/error'));
    return app;
  }

  test('DELETE notify template referenced in OrderStatus → 400 TEMPLATE_IN_USE', async () => {
    const app = makeApp();

    // Create notify template (DEV store)
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: 'tpl-del-mail', name: 'Mail', subject: 'Order {{order.id}}', bodyHtml: '<p>Hello</p>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const tpl = res.body.item;

    // Mock exists to simulate usage by status actions (by id or code)
    OrderStatus.exists.mockImplementation(async (filter) => {
      const em = filter && filter.actions && filter.actions.$elemMatch;
      if (!em) return false;
      if (em.type === 'notify') {
        const id = em.templateId;
        return id === tpl._id || id === tpl.code;
      }
      return false;
    });

    // Attempt to delete → should be blocked
    res = await request(app)
      .delete(`/api/notify/templates/${tpl._id}`)
      .set('x-user-role', 'settings.notify:*');
    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('TEMPLATE_IN_USE');
  });

  test('DELETE doc template referenced in OrderStatus → 400 TEMPLATE_IN_USE', async () => {
    const app = makeApp();

    // Create doc template (DEV store)
    let res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: 'tpl-del-doc', name: 'Doc', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const tpl = res.body.item;

    // Mock exists to simulate usage by status actions (by id or code)
    OrderStatus.exists.mockImplementation(async (filter) => {
      const em = filter && filter.actions && filter.actions.$elemMatch;
      if (!em) return false;
      if (em.type === 'print') {
        const id = em.docId;
        return id === tpl._id || id === tpl.code;
      }
      return false;
    });

    // Attempt to delete → should be blocked
    res = await request(app)
      .delete(`/api/doc-templates/${tpl._id}`)
      .set('x-user-role', 'settings.docs:*');
    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('TEMPLATE_IN_USE');
  });
});