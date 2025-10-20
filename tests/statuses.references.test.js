const request = require('supertest');
const express = require('express');

let OrderStatus;

describe('OrderStatus POST/PUT: reference validation', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    jest.doMock('../models/OrderStatus', () => ({
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      GROUPS: ['draft', 'in_progress', 'closed_success', 'closed_fail'],
    }));
    OrderStatus = require('../models/OrderStatus');
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/auth').withUser);
    app.use('/api/statuses', require('../routes/statuses'));
    app.use(require('../middleware/error'));
    return app;
  }

  test('POST invalid notify reference → 400 INVALID_REFERENCE', async () => {
    const app = makeApp();
    const missingId = 'tpl-missing';

    const res = await request(app)
      .post('/api/statuses')
      .set('x-user-role', 'settings.statuses:create')
      .send({
        code: 'notify-check',
        name: 'Notify Check',
        color: '#000000',
        group: 'in_progress',
        order: 0,
        actions: [{ type: 'notify', templateId: missingId, channel: 'email' }],
      });

    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('INVALID_REFERENCE');
    expect(res.body && res.body.details && res.body.details.type).toBe('notify');
    expect(res.body && res.body.details && res.body.details.id).toBe(missingId);
    expect(OrderStatus.create).not.toHaveBeenCalled();
  });

  test('POST valid notify reference (DEV store by id) → 201', async () => {
    const app = makeApp();
    const TemplatesStore = require('../services/templatesStore');
    const tpl = TemplatesStore.createNotifyTemplate({
      code: 'email1', name: 'Email', channel: 'email', subject: 'Order {{order.id}}', bodyHtml: '<p>Ok</p>',
    });

    OrderStatus.create.mockResolvedValue({ _id: 'st1', code: 'notify-ok' });

    const res = await request(app)
      .post('/api/statuses')
      .set('x-user-role', 'settings.statuses:create')
      .send({
        code: 'notify-ok',
        name: 'Notify OK',
        color: '#000000',
        group: 'in_progress',
        order: 0,
        actions: [{ type: 'notify', templateId: tpl._id, channel: 'email' }],
      });

    expect(res.status).toBe(201);
    expect(OrderStatus.create).toHaveBeenCalledTimes(1);
  });

  test('PUT invalid print reference → 400 INVALID_REFERENCE', async () => {
    const app = makeApp();

    OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'st2', code: 'print-check', system: false }) });

    const res = await request(app)
      .put('/api/statuses/st2')
      .set('x-user-role', 'settings.statuses:update')
      .send({ actions: [{ type: 'print', docId: 'doc-missing' }] });

    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('INVALID_REFERENCE');
    expect(res.body && res.body.details && res.body.details.type).toBe('print');
    expect(res.body && res.body.details && res.body.details.id).toBe('doc-missing');
    expect(OrderStatus.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('PUT valid print reference (DEV store by code) → 200', async () => {
    const app = makeApp();
    const TemplatesStore = require('../services/templatesStore');
    TemplatesStore.createDocTemplate({ code: 'doc1', name: 'Doc 1', bodyHtml: '<h1>Order {{order.id}}</h1>' });

    OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'st3', code: 'print-ok', system: false }) });
    OrderStatus.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'st3', code: 'print-ok' }) });

    const res = await request(app)
      .put('/api/statuses/st3')
      .set('x-user-role', 'settings.statuses:update')
      .send({ actions: [{ type: 'print', docId: 'doc1' }] });

    expect(res.status).toBe(200);
    expect(OrderStatus.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });
});