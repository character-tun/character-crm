const request = require('supertest');
const express = require('express');

// DEV mode, in-memory queue and templates
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/notify/dev', require('../routes/notifyDev'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/files', require('../routes/files'));
  app.use('/api/queue', require('../routes/queue'));
  app.use(require('../middleware/error'));
  return app;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

describe('e2e DEV: notify + print actions write to outbox, no files', () => {
  beforeEach(() => { jest.resetModules(); });

  test('create templates, change status, verify outbox and files', async () => {
    const app = makeApp();

    // Create notify template
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: 'tpl-dev-mail', name: 'Dev mail', subject: 'Order {{order.id}}', bodyHtml: '<p>Client: {{client.name}}</p>', variables: ['order.id', 'client.name'],
      });
    expect(res.status).toBe(200);
    const notifyTplId = res.body.item._id;

    // Create doc template
    res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: 'tpl-dev-doc', name: 'Dev doc', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const docTplId = res.body.item._id;

    const orderId = 'ord-e2e-dev-1';

    // Patch order status enqueuing notify+print
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', 'u-dev-1')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', actions: [{ type: 'notify', templateId: notifyTplId }, { type: 'print', docId: docTplId }] });
    expect(res.status).toBe(200);

    // Wait for mem queue to process
    await sleep(50);

    // Check DEV outbox
    res = await request(app)
      .get('/api/notify/dev/outbox?limit=10&offset=0')
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(200);
    const items = res.body.items || [];
    // Should include both notify and print entries for this order
    const hasNotify = items.some((i) => i.type === 'notify' && i.orderId === orderId);
    const hasPrint = items.some((i) => i.type === 'print' && i.orderId === orderId);
    expect(hasNotify).toBe(true);
    expect(hasPrint).toBe(true);

    // Files for order should be empty in DRY_RUN
    res = await request(app)
      .get(`/api/orders/${orderId}/files`)
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBe(0);
  });
});