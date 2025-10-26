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

let sendMail;

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

describe('e2e PROD-like: notify sends email and print saves file', () => {
  beforeEach(() => {
    jest.resetModules();
    // Mock nodemailer and puppeteer BEFORE requiring modules
    sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }), { virtual: true });
    const pdfBuffer = Buffer.from('%PDF-1.4');
    jest.doMock('puppeteer', () => ({
      launch: async () => ({
        newPage: async () => ({ setContent: async () => {}, pdf: async () => pdfBuffer }),
        close: async () => {},
      }),
    }), { virtual: true });

    // Ensure Mongo-ready branch for status change route
    const mongoose = require('mongoose');
    try { mongoose.connection.readyState = 1; } catch (e) {
      Object.defineProperty(mongoose, 'connection', { value: { readyState: 1 }, configurable: true });
    }

    // Shared state for dynamic mocks
    const state = { orderDoc: null, notifyTplId: null, docTplId: null };
    global.__e2eState = state;

    // Mock Order model used by service and routes
    const orderModelPath = require.resolve('../models/Order');
    jest.doMock(orderModelPath, () => ({
      findById: jest.fn((id) => {
        const makeDoc = () => {
          const src = (global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id)) ? global.__e2eState.orderDoc : null;
          if (!src) return null;
          // Return a mutable doc with save()
          const doc = { ...src };
          doc.save = async () => {
            global.__e2eState.orderDoc = { ...global.__e2eState.orderDoc, status: doc.status, statusChangedAt: doc.statusChangedAt, closed: doc.closed };
            return { ...global.__e2eState.orderDoc };
          };
          return doc;
        };
        return {
          lean: jest.fn().mockResolvedValue((() => { const d = makeDoc(); return d ? { ...d, save: undefined } : null; })()),
          then: (resolve) => resolve(makeDoc()),
        };
      }),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => {
          const match = global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id);
          if (!match) return null;
          const next = { ...global.__e2eState.orderDoc, ...(patch && patch.$set ? patch.$set : {}) };
          global.__e2eState.orderDoc = next;
          return { ...next };
        })()),
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
      create: jest.fn(async () => ({ _id: 'log-e2e-2' })),
    }));

    // Mock Client model to avoid Mongoose connection requirements in routes
    const clientModelPath = require.resolve('../models/Client');
    jest.doMock(clientModelPath, () => ({
      create: jest.fn(async (doc) => ({ _id: doc && doc._id ? doc._id : 'client-mock-1', ...doc })),
    }));

    // Mongo-only: mock NotifyTemplate to avoid hitting Mongoose
    const mem = [];
    const notifyModelPath = require.resolve('../models/NotifyTemplate');
    jest.doMock(notifyModelPath, () => ({
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(mem.map((i) => ({ ...i }))) })),
      findOne: jest.fn((filter) => ({
        lean: jest.fn().mockResolvedValue(mem.find((i) => String(i.code) === String(filter?.code)) || null),
        then: (resolve) => resolve(mem.find((i) => String(i.code) === String(filter?.code)) || null),
      })),
      create: jest.fn(async (data) => {
        const item = { _id: data.code || `tpl-${mem.length + 1}`, ...data };
        mem.push(item);
        return item;
      }),
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue(mem.find((i) => String(i._id) === String(id)) || null),
      })),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => {
          const idx = mem.findIndex((i) => String(i._id) === String(id));
          if (idx === -1) return null;
          mem[idx] = { ...mem[idx], ...patch };
          return { ...mem[idx] };
        })()),
      })),
      deleteOne: jest.fn(async (f) => {
        const idx = mem.findIndex((i) => String(i._id) === String(f._id));
        if (idx === -1) return { deletedCount: 0 };
        mem.splice(idx, 1);
        return { deletedCount: 1 };
      }),
    }));
  });

  test('create templates, change status, verify email sent and file downloadable', async () => {
    const app = makeApp();

    const unique = Date.now().toString(36);

    // Create notify template
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: `tpl-prod-mail-${unique}`, name: 'Prod mail', subject: 'Order {{order.id}}', bodyHtml: '<p>Prod</p>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const notifyTplId = res.body.item._id;

    // Create doc template
    res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: `tpl-prod-doc-${unique}`, name: 'Prod doc', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const docTplId = res.body.item._id;

    // Share created template ids with mocked OrderStatus
    global.__e2eState.notifyTplId = notifyTplId;
    global.__e2eState.docTplId = docTplId;

    const orderId = '507f1f77bcf86cd799439015';
    const userId = '507f1f77bcf86cd799439016';
    global.__e2eState.orderDoc = { _id: orderId, files: [] };

    // Patch order status enqueuing notify+print
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', userId)
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'in_work' });
    expect(res.status).toBe(200);

    // Wait for mem queue to process
    await sleep(50);

    // Email was sent once via SMTP
    expect(sendMail).toHaveBeenCalledTimes(1);
    const args = sendMail.mock.calls[0][0];
    expect(args).toHaveProperty('from', process.env.SMTP_FROM);
    expect(args).toHaveProperty('to', process.env.SMTP_TO);
    expect(args.subject).toContain(orderId);

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
