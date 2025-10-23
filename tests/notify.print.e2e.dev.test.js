const request = require('supertest');
const express = require('express');

// DEV mode, in-memory queue and templates
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';

// Mocks to ensure DRY_RUN does not touch external systems
const stubMailerSend = jest.fn().mockResolvedValue({ messageId: 'dry-e2e' });
jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail: stubMailerSend }) }), { virtual: true });
const stubPuppeteerLaunch = jest.fn();
jest.doMock('puppeteer', () => ({ launch: stubPuppeteerLaunch }), { virtual: true });

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/files', require('../routes/files'));
  app.use('/api/queue', require('../routes/queue'));
  app.use(require('../middleware/error'));
  return app;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

describe('e2e DEV: notify + print DRY_RUN — no SMTP or files', () => {
  beforeEach(() => {
    jest.resetModules();
    // Reapply mocks after resetModules
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail: stubMailerSend }) }), { virtual: true });
    jest.doMock('puppeteer', () => ({ launch: stubPuppeteerLaunch }), { virtual: true });

    // Ensure Mongo-ready branch for status change route
    const mongoose = require('mongoose');
    try { mongoose.connection.readyState = 1; } catch (e) {
      Object.defineProperty(mongoose, 'connection', { value: { readyState: 1 }, configurable: true });
    }

    // Shared state for dynamic mocks
    const state = { orderDoc: null, notifyTplId: null, docTplId: null };
    // Expose state to test via global to update after template creation
    global.__e2eState = state;

    // Mock Order model used by service
    const orderModelPath = require.resolve('../models/Order');
    jest.doMock(orderModelPath, () => ({
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue((global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id)) ? { ...global.__e2eState.orderDoc } : null),
        then: (resolve) => resolve((global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id)) ? global.__e2eState.orderDoc : null),
      })),
    }));

    // Mock OrderStatus to return actions referencing created templates
    const orderStatusModelPath = require.resolve('../models/OrderStatus');
    jest.doMock(orderStatusModelPath, () => ({
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({ code: 'in_work', group: 'in_progress', actions: [
          { type: 'notify', templateId: global.__e2eState.notifyTplId },
          { type: 'print', docId: global.__e2eState.docTplId },
        ] }),
      })),
    }));

    // Mock OrderStatusLog.create to avoid ObjectId errors and return log id
    const orderStatusLogModelPath = require.resolve('../models/OrderStatusLog');
    jest.doMock(orderStatusLogModelPath, () => ({
      create: jest.fn(async () => ({ _id: 'log-e2e-1' })),
    }));

    // Mock Client to avoid real mongoose.model compilation
    const clientModelPath = require.resolve('../models/Client');
    jest.doMock(clientModelPath, () => ({
      create: jest.fn(async () => ({ _id: 'c1' })),
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id }) })),
    }));

    // Mongo-only: mock NotifyTemplate to avoid Mongoose calls in DEV
    const notifyMem = [];
    const notifyModelPath = require.resolve('../models/NotifyTemplate');
    jest.doMock(notifyModelPath, () => ({
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(notifyMem.map((i) => ({ ...i }))) })),
      findOne: jest.fn((filter) => ({
        lean: jest.fn().mockResolvedValue(notifyMem.find((i) => String(i.code) === String(filter?.code)) || null),
        then: (resolve) => resolve(notifyMem.find((i) => String(i.code) === String(filter?.code)) || null),
      })),
      create: jest.fn(async (data) => {
        const item = { _id: data.code || `tpl-${notifyMem.length + 1}` , ...data };
        notifyMem.push(item);
        return item;
      }),
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue(notifyMem.find((i) => String(i._id) === String(id)) || null),
      })),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => {
          const idx = notifyMem.findIndex((i) => String(i._id) === String(id));
          if (idx === -1) return null;
          notifyMem[idx] = { ...notifyMem[idx], ...patch };
          return { ...notifyMem[idx] };
        })()),
      })),
      deleteOne: jest.fn(async (f) => {
        const idx = notifyMem.findIndex((i) => String(i._id) === String(f._id));
        if (idx === -1) return { deletedCount: 0 };
        notifyMem.splice(idx, 1);
        return { deletedCount: 1 };
      }),
    }));

    // Mongo-only: mock DocTemplate to avoid Mongoose calls in DEV
    const docMem = [];
    const docModelPath = require.resolve('../models/DocTemplate');
    jest.doMock(docModelPath, () => ({
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(docMem.map((i) => ({ ...i }))) })),
      findOne: jest.fn((filter) => ({ lean: jest.fn().mockResolvedValue(docMem.find((i) => String(i.code) === String(filter?.code)) || null) })),
      create: jest.fn(async (data) => {
        const item = { _id: data.code || `doc-${docMem.length + 1}` , ...data };
        docMem.push(item);
        return item;
      }),
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue(docMem.find((i) => String(i._id) === String(id)) || null),
      })),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => {
          const idx = docMem.findIndex((i) => String(i._id) === String(id));
          if (idx === -1) return null;
          docMem[idx] = { ...docMem[idx], ...patch };
          return { ...docMem[idx] };
        })()),
      })),
      deleteOne: jest.fn(async (f) => {
        const idx = docMem.findIndex((i) => String(i._id) === String(f._id));
        if (idx === -1) return { deletedCount: 0 };
        docMem.splice(idx, 1);
        return { deletedCount: 1 };
      }),
    }));
  });

  test('create templates, change status, verify DRY_RUN behavior and files', async () => {
    const app = makeApp();

    const unique = Date.now().toString(36);

    // Create notify template
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: `tpl-dev-mail-${unique}`, name: 'Dev mail', subject: 'Order {{order.id}}', bodyHtml: '<p>Client: {{client.name}}</p>', variables: ['order.id', 'client.name'],
      });
    expect(res.status).toBe(200);
    const notifyTplCode = res.body.item.code;

    // Create doc template
    res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: `tpl-dev-doc-${unique}`, name: 'Dev doc', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const docTplCode = res.body.item.code;

    const orderId = '507f1f77bcf86cd799439013';

    // Provide order doc and template ids to mocks
    global.__e2eState.orderDoc = { _id: orderId, status: 'draft', files: [], totals: { subtotal: 0, discountTotal: 0, grandTotal: 0 }, save: jest.fn().mockResolvedValue(true) };
    global.__e2eState.notifyTplId = notifyTplCode;
    global.__e2eState.docTplId = docTplCode;

    // Patch order status enqueuing notify+print
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', '507f1f77bcf86cd799439006')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work' });
    expect(res.status).toBe(200);

    // Wait for mem queue to process
    await sleep(50);

    // DRY_RUN ensures nodemailer and puppeteer were not invoked
    expect(stubMailerSend).not.toHaveBeenCalled();
    expect(stubPuppeteerLaunch).not.toHaveBeenCalled();

    // Files for order should be empty in DRY_RUN
    res = await request(app)
      .get(`/api/orders/${orderId}/files`)
      .set('x-user-role', 'Admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBe(0);
  });
});