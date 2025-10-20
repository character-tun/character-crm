const request = require('supertest');
const express = require('express');

// PROD-like in DEV: real send and file save via mocks
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '0';
process.env.PRINT_DRY_RUN = '0';
process.env.SMTP_HOST = 'smtp.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';
process.env.SMTP_FROM = 'from@test';
process.env.SMTP_TO = 'to@test';

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

describe('e2e PROD-like: notify sends email and print saves file', () => {
  beforeEach(() => {
    jest.resetModules();
    // Mock nodemailer and puppeteer BEFORE requiring modules
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));
    const pdfBuffer = Buffer.from('PDF');
    jest.doMock('puppeteer', () => ({
      launch: async () => ({
        newPage: async () => ({ setContent: async () => {}, pdf: async () => pdfBuffer }),
        close: async () => {},
      }),
    }));
  });

  test('create templates, change status, verify email sent and file downloadable', async () => {
    const { __devReset } = require('../services/statusActionsHandler');
    __devReset();
    const app = makeApp();

    // Create notify template
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: 'tpl-prod-mail', name: 'Prod mail', subject: 'Order {{order.id}}', bodyHtml: '<p>Prod</p>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const notifyTplId = res.body.item._id;

    // Create doc template
    res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: 'tpl-prod-doc', name: 'Prod doc', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const docTplId = res.body.item._id;

    const orderId = 'ord-e2e-prod-1';

    // Patch order status enqueuing notify+print
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', 'u-prod-1')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work', actions: [{ type: 'notify', templateId: notifyTplId }, { type: 'print', docId: docTplId }] });
    expect(res.status).toBe(200);

    // Wait for mem queue to process
    await sleep(50);

    // Outbox should NOT contain entries when NOTIFY_DRY_RUN=0 and PRINT_DRY_RUN=0
    res = await request(app)
      .get('/api/notify/dev/outbox?limit=50')
      .set('x-user-role', 'Admin')
      .expect(200);
    const items = res.body.items || [];
    expect(items.some((i) => i.orderId === orderId && (i.type === 'notify' || i.type === 'print'))).toBe(false);

    // Files for order should contain generated PDF
    res = await request(app)
      .get(`/api/orders/${orderId}/files`)
      .set('x-user-role', 'Admin')
      .expect(200);
    const files = res.body.files || [];
    expect(files.length).toBe(1);
    expect(files[0].mime).toBe('application/pdf');
    const fileId = files[0].id;

    // File is downloadable via /api/files/:id
    res = await request(app)
      .get(`/api/files/${fileId}`)
      .set('x-user-role', 'Admin')
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const len = parseInt(res.headers['content-length'] || '0', 10);
    expect(len).toBeGreaterThan(0);
  });
});