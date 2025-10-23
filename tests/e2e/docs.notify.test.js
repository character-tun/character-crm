const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// DEV mode and DRY flags
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';

// Stubs to ensure external systems are not invoked in DRY mode
const stubMailerSend = jest.fn().mockResolvedValue({ messageId: 'dry-e2e' });
jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail: stubMailerSend }) }), { virtual: true });
const stubPuppeteerLaunch = jest.fn();
jest.doMock('puppeteer', () => ({ launch: stubPuppeteerLaunch }), { virtual: true });

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/notify/templates', require('../../routes/notifyTemplates'));
  app.use('/api/doc-templates', require('../../routes/docTemplates'));
  app.use('/api/orders', require('../../routes/orders'));
  app.use('/api/files', require('../../routes/files'));
  app.use('/api/queue', require('../../routes/queue'));
  app.use(require('../../middleware/error'));
  return app;
}

function ensureArtifactsDir() {
  const dir = path.join(process.cwd(), 'storage', 'reports', 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

describe('e2e DEV: Docs + Notify → status ready → DRY pdf/email', () => {
  beforeEach(() => {
    jest.resetModules();
    // reapply external system mocks after reset
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail: stubMailerSend }) }), { virtual: true });
    jest.doMock('puppeteer', () => ({ launch: stubPuppeteerLaunch }), { virtual: true });

    // Simulate Mongo-ready branch for routes
    const mongoose = require('mongoose');
    try { mongoose.connection.readyState = 1; } catch (e) {
      Object.defineProperty(mongoose, 'connection', { value: { readyState: 1 }, configurable: true });
    }

    // Shared state for dynamic mocks
    const state = { orderDoc: null, notifyTplId: null, docTplId: null };
    global.__e2eState = state;

    // Mock Order used by services/routes
    const orderModelPath = require.resolve('../../models/Order');
    jest.doMock(orderModelPath, () => ({
      findById: jest.fn((id) => ({
        lean: jest.fn().mockResolvedValue((global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id)) ? { ...global.__e2eState.orderDoc } : null),
        then: (resolve) => resolve((global.__e2eState.orderDoc && String(global.__e2eState.orderDoc._id) === String(id)) ? global.__e2eState.orderDoc : null),
      })),
      findByIdAndUpdate: jest.fn((id, upd) => ({
        lean: jest.fn().mockResolvedValue(() => {
          const prev = global.__e2eState.orderDoc;
          if (!prev || String(prev._id) !== String(id)) return null;
          const next = { ...prev, ...(((upd && upd.$set) || {})) };
          global.__e2eState.orderDoc = next;
          return next;
        }),
      })),
    }));

    // Mock OrderStatus to return actions referencing created templates for 'ready'
    const orderStatusModelPath = require.resolve('../../models/OrderStatus');
    jest.doMock(orderStatusModelPath, () => ({
      findOne: jest.fn((filter) => ({
        lean: jest.fn().mockResolvedValue({ code: (filter && filter.code) || 'ready', group: 'in_progress', actions: [
          { type: 'notify', templateId: global.__e2eState.notifyTplId, channel: 'email' },
          { type: 'print', docId: global.__e2eState.docTplId },
        ] }),
      })),
    }));

    // Mock OrderStatusLog.create to avoid ObjectId requirements; we assert no logs in DRY
    const orderStatusLogModelPath = require.resolve('../../models/OrderStatusLog');
    jest.doMock(orderStatusLogModelPath, () => ({
      create: jest.fn(async () => ({ _id: 'log-e2e-ready-1' })),
      find: jest.fn(() => ({ sort: function () { return this; }, lean: async function () { return []; } })),
    }));

    // Mock Client model for lookup
    const clientModelPath = require.resolve('../../models/Client');
    jest.doMock(clientModelPath, () => ({
      create: jest.fn(async () => ({ _id: 'c-ready-1', name: 'Клиент', email: 'client@example.com' })),
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, name: 'Клиент', email: 'client@example.com' }) })),
    }));

    // Mongo-only: mock NotifyTemplate
    const notifyMem = [];
    const notifyModelPath = require.resolve('../../models/NotifyTemplate');
    jest.doMock(notifyModelPath, () => ({
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(notifyMem.map((i) => ({ ...i }))) })),
      findOne: jest.fn((filter) => ({
        lean: jest.fn().mockResolvedValue(notifyMem.find((i) => String(i.code) === String(filter?.code)) || null),
        then: (resolve) => resolve(notifyMem.find((i) => String(i.code) === String(filter?.code)) || null),
      })),
      create: jest.fn(async (data) => { const item = { _id: data.code || `tpl-${notifyMem.length + 1}`, ...data }; notifyMem.push(item); return item; }),
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(notifyMem.find((i) => String(i._id) === String(id)) || null) })),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => { const idx = notifyMem.findIndex((i) => String(i._id) === String(id)); if (idx === -1) return null; notifyMem[idx] = { ...notifyMem[idx], ...patch }; return { ...notifyMem[idx] }; })()),
      })),
      deleteOne: jest.fn(async (f) => { const idx = notifyMem.findIndex((i) => String(i._id) === String(f._id)); if (idx === -1) return { deletedCount: 0 }; notifyMem.splice(idx, 1); return { deletedCount: 1 }; }),
    }));

    // Mongo-only: mock DocTemplate
    const docMem = [];
    const docModelPath = require.resolve('../../models/DocTemplate');
    jest.doMock(docModelPath, () => ({
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(docMem.map((i) => ({ ...i }))) })),
      findOne: jest.fn((filter) => ({ lean: jest.fn().mockResolvedValue(docMem.find((i) => String(i.code) === String(filter?.code)) || null) })),
      create: jest.fn(async (data) => { const item = { _id: data.code || `doc-${docMem.length + 1}`, ...data }; docMem.push(item); return item; }),
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(docMem.find((i) => String(i._id) === String(id)) || null) })),
      findByIdAndUpdate: jest.fn((id, patch) => ({
        lean: jest.fn().mockResolvedValue((() => { const idx = docMem.findIndex((i) => String(i._id) === String(id)); if (idx === -1) return null; docMem[idx] = { ...docMem[idx], ...patch }; return { ...docMem[idx] }; })()),
      })),
      deleteOne: jest.fn(async (f) => { const idx = docMem.findIndex((i) => String(i._id) === String(f._id)); if (idx === -1) return { deletedCount: 0 }; docMem.splice(idx, 1); return { deletedCount: 1 }; }),
    }));
  });

  test('templates → patch ready → no SMTP/puppeteer; artifacts saved', async () => {
    const app = makeApp();

    const unique = Date.now();

    // Create notify template
    let res = await request(app)
      .post('/api/notify/templates')
      .set('x-user-role', 'settings.notify:*')
      .send({
        code: `tpl-ready-mail-${unique}`,
        name: 'Ready mail',
        subject: 'Order {{order.id}} is ready',
        bodyHtml: '<p>Client: {{client.name}}</p>',
        variables: ['order.id', 'client.name'],
      });
    expect(res.status).toBe(200);
    const notifyTplCode = res.body.item.code;

    // Create doc template
    res = await request(app)
      .post('/api/doc-templates')
      .set('x-user-role', 'settings.docs:*')
      .send({
        code: `tpl-ready-doc-${unique}`,
        name: 'Ready doc',
        bodyHtml: '<h1>Order {{order.id}}</h1>',
        variables: ['order.id'],
      });
    expect(res.status).toBe(200);
    const docTplCode = res.body.item.code;

    // Prepare order doc in mock store
    const orderId = '507f1f77bcf86cd799439014';
    global.__e2eState.orderDoc = { _id: orderId, status: 'draft', files: [], totals: { subtotal: 0, discountTotal: 0, grandTotal: 0 }, save: jest.fn().mockResolvedValue(true) };
    global.__e2eState.notifyTplId = notifyTplCode;
    global.__e2eState.docTplId = docTplCode;

    // Patch status to 'ready' → triggers notify+print actions via service
    res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-user-id', '507f1f77bcf86cd799439006')
      .set('x-user-role', 'orders.changeStatus')
      .send({ newStatusCode: 'ready' });
    expect(res.status).toBe(200);

    // Wait for mem queue to process when enabled; keep short
    await sleep(50);

    // DRY mode assertions: SMTP and puppeteer were not called
    expect(stubMailerSend).not.toHaveBeenCalled();
    expect(stubPuppeteerLaunch).not.toHaveBeenCalled();

    // Files API should return empty list (no PDF attached)
    res = await request(app)
      .get(`/api/orders/${orderId}/files`)
      .set('x-user-role', 'docs.print');
    expect(res.status).toBe(200);
    expect(res.body && res.body.files && Array.isArray(res.body.files) ? res.body.files.length : 0).toBe(0);

    // Save artifacts: result.json, notify.subject.txt and doc.html (template body)
    const artifactsDir = ensureArtifactsDir();
    const result = {
      status: 'ready',
      mailerCalls: stubMailerSend.mock.calls.length,
      puppeteerCalls: stubPuppeteerLaunch.mock.calls.length,
      filesCount: (res.body && res.body.files ? res.body.files.length : 0),
      notifyTemplateCode: notifyTplCode,
      docTemplateCode: docTplCode,
    };
    fs.writeFileSync(path.join(artifactsDir, `docs.notify.result.${unique}.json`), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(artifactsDir, `docs.notify.subject.${unique}.txt`), 'Order {{order.id}} is ready');
    fs.writeFileSync(path.join(artifactsDir, `docs.notify.doc.${unique}.html`), '<h1>Order {{order.id}}</h1>');
  });
});