/*
Run a smaller load/perf scenario outside Jest to validate:
- DEV fallbacks for statuses/doc-templates
- Orders status PATCH route
- In-memory queue processing and metrics
- Report generation under storage/reports
*/

process.env.AUTH_DEV_MODE = '1';
process.env.NODE_ENV = 'test';
process.env.ENABLE_STATUS_QUEUE = '1';
process.env.MEM_ATTEMPTS = '1';
process.env.MEM_BACKOFF_BASE_MS = '1';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { withUser } = require('../middleware/auth');
const statusesRoute = require('../routes/statuses');
const docTemplatesRoute = require('../routes/docTemplates');
const ordersRoute = require('../routes/orders');
const queueRoute = require('../routes/queue');
const { getCache, resetAll } = require('../services/ttlCache');

// Simple DEV mocks for models similar to test setup
globalThis.__OrdersMem = new Map();
globalThis.__LogsCounter = 1;

jestLikeMock('../models/Order', () => ({
  findById: async (id) => {
    const o = globalThis.__OrdersMem.get(String(id));
    if (!o) return null;
    return {
      ...o,
      save: async function save() { globalThis.__OrdersMem.set(String(this._id), this); return this; },
    };
  },
}));

jestLikeMock('../models/OrderStatus', () => ({
  findOne: (q) => ({
    lean: async () => {
      const s = globalThis.__STATUSES.find((x) => x.code === q.code);
      return s ? { ...s } : null;
    },
  }),
  find: () => ({
    sort() { return this; },
    lean: async () => globalThis.__STATUSES.map((x) => ({ ...x })),
  }),
}));

jestLikeMock('../models/OrderStatusLog', () => ({
  create: async (doc) => ({ _id: `log_${globalThis.__LogsCounter++}`, ...doc }),
}));

// Statuses including an action on in_work
globalThis.__STATUSES = [
  { code: 'new', name: 'Новый', group: 'open', actions: [] },
  { code: 'in_work', name: 'В работе', group: 'open', actions: [{ type: 'notify', channel: 'email', templateId: 'welcome_tpl' }] },
  { code: 'closed_paid', name: 'Закрыт (оплачено)', group: 'closed_success', actions: [{ type: 'print', docId: 'invoice_tpl' }, { type: 'notify', channel: 'email', templateId: 'closing_tpl' }] },
  { code: 'closed_unpaid', name: 'Закрыт (без оплаты)', group: 'closed', actions: [] },
  { code: 'archived', name: 'В архиве', group: 'archived', actions: [] },
];

function jestLikeMock(modulePath, factory) {
  const abs = require.resolve(modulePath, { paths: [__dirname] });
  const mod = factory();
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: mod };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(withUser);
  app.use('/api/statuses', statusesRoute);
  app.use('/api/doc-templates', docTemplatesRoute);
  app.use('/api/orders', ordersRoute);
  app.use('/api/queue', queueRoute);
  return app;
}

function toObjectIdString(n) {
  const s = String(n);
  return s.length >= 24 ? s.slice(0, 24) : '0'.repeat(24 - s.length) + s;
}

async function ensureReportsDir() {
  const p = path.join(__dirname, '../storage/reports');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

async function measureList(app, url, headers, times) {
  const durations = [];
  for (let i = 0; i < times; i += 1) {
    const t0 = Date.now();
    await request(app).get(url).set(headers).expect(200);
    durations.push(Date.now() - t0);
  }
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95Idx = Math.floor(durations.length * 0.95) - 1;
  const sorted = durations.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.max(0, p95Idx)];
  return { avg, p95, samples: durations.length };
}

function fmtMetrics(m) {
  return `waiting=${m.waiting} active=${m.active} delayed=${m.delayed} processed24h=${m.processed24h} failed24h=${m.failed24h}\n` +
    `failedLastHour=${m.failedLastHour}\n`;
}

async function main() {
  // Force DEV fallback in status route
  mongoose.connection.readyState = 0;
  mongoose.connection.db = undefined;

  // Seed DEV templates for references
  const TemplatesStore = require('../services/templatesStore');
  TemplatesStore.createNotifyTemplate({ code: 'welcome_tpl', name: 'Welcome', subject: 'Order {{order.id}}', bodyHtml: '<p>Welcome</p>', variables: ['order.id'] });
  TemplatesStore.createNotifyTemplate({ code: 'closing_tpl', name: 'Closing', subject: 'Order {{order.id}} closed', bodyHtml: '<p>Closed</p>', variables: ['order.id'] });
  TemplatesStore.createDocTemplate({ code: 'invoice_tpl', name: 'Invoice', bodyHtml: '<h1>Invoice for {{order.id}}</h1>', variables: ['order.id'] });

  const app = makeApp();
  const uid = '507f1f77bcf86cd799439011';
  const adminHeaders = { 'x-user-id': uid, 'x-user-role': 'Admin' };
  const docsHeaders = { 'x-user-id': uid, 'x-user-role': 'settings.docs:*' };
  const changeHeaders = { 'x-user-id': uid, 'x-user-role': 'orders.changeStatus' };

  // Prepare 200 orders
  for (let i = 1; i <= 200; i += 1) {
    const oid = toObjectIdString(i);
    globalThis.__OrdersMem.set(oid, { _id: oid, status: 'new', closed: false, paymentsLocked: false, totals: { total: 1000 } });
  }

  const reportsDir = await ensureReportsDir();

  // Warm TTL caches
  const listStatuses1 = await measureList(app, '/api/statuses', adminHeaders, 10);
  const listStatuses2 = await measureList(app, '/api/statuses', adminHeaders, 10);
  const listDocs1 = await measureList(app, '/api/doc-templates', docsHeaders, 10);
  const listDocs2 = await measureList(app, '/api/doc-templates', docsHeaders, 10);

  const statusesStats = getCache('statuses').stats();
  const docsStats = getCache('docTemplates').stats();

  const targetStatuses = ['closed_unpaid', 'in_work'];
  const PATCHES = 1000;
  let sent = 0;
  for (let i = 0; i < PATCHES; i += 1) {
    const oid = toObjectIdString((i % 200) + 1);
    const code = targetStatuses[i % targetStatuses.length];
    await request(app)
      .patch(`/api/orders/${oid}/status`)
      .set(changeHeaders)
      .send({ newStatusCode: code, note: `perf_${i}` })
      .expect(200);
    sent += 1;
  }

  async function pollMetrics() {
    const res = await request(app).get('/api/queue/status-actions/metrics?n=100').set(adminHeaders).expect(200);
    return res.body || {};
  }

  let metrics = await pollMetrics();
  const deadline = Date.now() + 60000; // up to 60s
  while ((((metrics.active || 0) + (metrics.waiting || 0) + (metrics.delayed || 0)) > 0 || (metrics.processed24h || 0) < sent) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    metrics = await pollMetrics();
  }

  const queueReport = [
    `Queue Load Test (1k)\nProcessed=${metrics.processed24h} Failed=${metrics.failed24h} Waiting=${metrics.waiting} Active=${metrics.active} Delayed=${metrics.delayed}`,
    fmtMetrics(metrics),
    `Hits/Misses TTL:\n- statuses: hits=${statusesStats.hits} misses=${statusesStats.misses} size=${statusesStats.size}\n- docTemplates: hits=${docsStats.hits} misses=${docsStats.misses} size=${docsStats.size}`,
    `List timings (ms):\n- statuses: cold avg=${listStatuses1.avg.toFixed(2)} p95=${listStatuses1.p95}\n- statuses: warm avg=${listStatuses2.avg.toFixed(2)} p95=${listStatuses2.p95}\n- docTemplates: cold avg=${listDocs1.avg.toFixed(2)} p95=${listDocs1.p95}\n- docTemplates: warm avg=${listDocs2.avg.toFixed(2)} p95=${listDocs2.p95}`,
  ].join('\n\n');

  fs.writeFileSync(path.join(reportsDir, 'queue-load-report-small.md'), queueReport, 'utf8');

  const perfReport = [
    `Perf Report (small)\nTTL Cache and Queue Metrics`,
    `TTL Cache:\nstatuses: hits=${statusesStats.hits}, misses=${statusesStats.misses}, size=${statusesStats.size}\ndocTemplates: hits=${docsStats.hits}, misses=${docsStats.misses}, size=${docsStats.size}`,
    `Lists Timing (ms):\nstatuses: avg=${listStatuses2.avg.toFixed(2)} p95=${listStatuses2.p95}\ndocTemplates: avg=${listDocs2.avg.toFixed(2)} p95=${listDocs2.p95}`,
    `Queue Metrics:\n${fmtMetrics(metrics)}`,
  ].join('\n\n');

  fs.writeFileSync(path.join(reportsDir, 'perf-report-small.md'), perfReport, 'utf8');

  console.log('Reports written:', {
    queueLoad: path.join(reportsDir, 'queue-load-report-small.md'),
    perf: path.join(reportsDir, 'perf-report-small.md'),
  });

  // Basic validations for script run
  if (!((statusesStats.hits + statusesStats.misses) > 0)) throw new Error('TTL statuses stats empty');
  if (!((docsStats.hits + docsStats.misses) > 0)) throw new Error('TTL docTemplates stats empty');
  if (!((metrics.processed24h || 0) >= PATCHES)) throw new Error(`Processed below sent: ${metrics.processed24h} < ${PATCHES}`);
  if (!((metrics.failed24h || 0) >= 0)) throw new Error('Failed24h negative');

  resetAll();
}

main().catch((err) => {
  console.error('runLoadPerf error', err && err.stack || err);
  process.exit(1);
});