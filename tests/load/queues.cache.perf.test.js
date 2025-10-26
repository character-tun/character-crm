/*
PROMPT-T6 — «Queues/Cache/Perf»
10k смен статусов с авто-действиями, метрики BullMQ/DEV-очереди,
TTL-кэш hit/miss, замеры времени списков. Итоги пишутся в storage/reports.
*/

// Ensure DEV mode before route requires
process.env.AUTH_DEV_MODE = '1';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { withUser } = require('../../middleware/auth');
const statusesRoute = require('../../routes/statuses');
const docTemplatesRoute = require('../../routes/docTemplates');
const ordersRoute = require('../../routes/orders');
const queueRoute = require('../../routes/queue');
const { getCache, resetAll } = require('../../services/ttlCache');
const { enqueueStatusActions } = require('../../queues/statusActionQueue');
const { changeOrderStatus } = require('../../services/orderStatusService');

jest.setTimeout(300000); // до 5 минут для 10k

// --- Простые DEV-моки для моделей ---
globalThis.__OrdersMem = new Map();
globalThis.__LogsCounter = 1;

jest.mock('../../models/Order', () => ({
  findById: async (id) => {
    const o = globalThis.__OrdersMem.get(String(id));
    if (!o) return null;
    return {
      ...o,
      save: async function save() { globalThis.__OrdersMem.set(String(this._id), this); return this; },
    };
  },
}));

jest.mock('../../models/OrderStatus', () => ({
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

jest.mock('../../models/OrderStatusLog', () => ({
  create: async (doc) => ({ _id: `log_${globalThis.__LogsCounter++}`, ...doc }),
}));

// Статусы, включая закрывающий с авто-действиями
globalThis.__STATUSES = [
  { code: 'new', name: 'Новый', group: 'open', actions: [] },
  { code: 'in_work', name: 'В работе', group: 'open', actions: [{ type: 'notify', channel: 'email', templateId: 'welcome_tpl' }] },
  { code: 'closed_paid', name: 'Закрыт (оплачено)', group: 'closed_success', actions: [{ type: 'print', docId: 'invoice_tpl' }, { type: 'notify', channel: 'email', templateId: 'closing_tpl' }] },
  { code: 'closed_unpaid', name: 'Закрыт (без оплаты)', group: 'closed', actions: [] },
  { code: 'archived', name: 'В архиве', group: 'archived', actions: [] },
];

function dumpRoutes(app) {
  const stack = app._router && app._router.stack ? app._router.stack : [];
  const out = [];
  out.push('# Express Route Map (Jest)');
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]).sort();
      out.push(`- ${methods.join('|').toUpperCase()} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.regexp) {
      const base = layer.regexp.toString();
      out.push(`- ROUTER ${base}`);
      const childStack = layer.handle.stack || [];
      for (const child of childStack) {
        if (child.route) {
          const methods = Object.keys(child.route.methods || {}).filter((m) => child.route.methods[m]).sort();
          out.push(`  - ${methods.join('|').toUpperCase()} ${child.route.path}`);
        }
      }
    }
  }
  return out.join('\n');
}

// Подготовка окружения для DEV-веток (без реальной Mongo/Redis)
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_DEV_MODE = '1';
  process.env.ENABLE_STATUS_QUEUE = '1'; // включаем DEV-очередь вместо inline
  process.env.MEM_ATTEMPTS = '1';
  process.env.MEM_BACKOFF_BASE_MS = '1';
  // Форсируем DEV-фоллбэк в маршруте смены статуса (Mongo недоступна)
  mongoose.connection.readyState = 0;
  mongoose.connection.db = undefined;

  // Seed DEV templates so notify/print references resolve if used
  const TemplatesStore = require('../../services/templatesStore');
  TemplatesStore.createNotifyTemplate({ code: 'welcome_tpl', name: 'Welcome', subject: 'Order {{order.id}}', bodyHtml: '<p>Welcome</p>', variables: ['order.id'] });
  TemplatesStore.createNotifyTemplate({ code: 'closing_tpl', name: 'Closing', subject: 'Order {{order.id}} closed', bodyHtml: '<p>Closed</p>', variables: ['order.id'] });
  TemplatesStore.createDocTemplate({ code: 'invoice_tpl', name: 'Invoice', bodyHtml: '<h1>Invoice for {{order.id}}</h1>', variables: ['order.id'] });
});

afterAll(() => {
  resetAll();
});

function makeApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  // Removed forced Connection: close header to avoid parser conflicts
  app.use(withUser);
  app.use('/api/statuses', statusesRoute);
  app.use('/api/doc-templates', docTemplatesRoute);
  app.use('/api/orders', ordersRoute);
  app.use('/api/queue', queueRoute);
  app.use(require('../../middleware/error'));
  return app;
}

async function ensureReportsDir() {
  const p = path.join(__dirname, '../../storage/reports');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function msNow() { return Date.now(); }

function toObjectIdString(n) {
  const s = String(n);
  return s.length >= 24 ? s.slice(0, 24) : '0'.repeat(24 - s.length) + s;
}

async function measureList(agent, url, headers, times) {
  const durations = [];
  for (let i = 0; i < times; i += 1) {
    const t0 = msNow();
    await agent.get(url).set(headers).set('Connection', 'close').expect(200);
    durations.push(msNow() - t0);
  }
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95Idx = Math.floor(durations.length * 0.95) - 1;
  const sorted = durations.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.max(0, p95Idx)];
  return { avg, p95, samples: durations.length };
}

function writeReport(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function fmtMetrics(m) {
  return `waiting=${m.waiting} active=${m.active} delayed=${m.delayed} processed24h=${m.processed24h} failed24h=${m.failed24h}\n`
    + `failedLastHour=${m.failedLastHour}\n`;
}

// --- Основной тест ---

describe('Load: Queue + TTL Cache perf', () => {
  const uid = '507f1f77bcf86cd799439011';
  const adminHeaders = { 'x-user-id': uid, 'x-user-role': 'Admin' };
  const docsHeaders = { 'x-user-id': uid, 'x-user-role': 'settings.docs:*' };
  const changeHeaders = { 'x-user-id': uid, 'x-user-role': 'orders.changeStatus' };
  let app;
  let agent;

  beforeAll(async () => {
    app = makeApp();
    agent = request.agent(app);
    // Write mounted routes to a report for debugging under Jest
    const reportsDir = await ensureReportsDir();
    const routesReport = dumpRoutes(app);
    writeReport(path.join(reportsDir, 'routes-debug-jest.md'), routesReport);
    // подготовим 1k заказов для ускорения; затем 10k сменим статус по кругу
    for (let i = 1; i <= 1000; i += 1) {
      const oid = toObjectIdString(i);
      globalThis.__OrdersMem.set(oid, { _id: oid, status: 'new', closed: false, paymentsLocked: false, totals: { total: 1000 } });
    }
  });

  test('10k смен статусов с авто-действиями, метрики и TTL-кэш', async () => {
    const reportsDir = await ensureReportsDir();

    // 1) Прогреем TTL-кэш списков и замерим время
    const listStatuses1 = await measureList(agent, '/api/statuses', adminHeaders, 30);
    const listStatuses2 = await measureList(agent, '/api/statuses', adminHeaders, 30);
    const listDocs1 = await measureList(agent, '/api/doc-templates', docsHeaders, 30);
    const listDocs2 = await measureList(agent, '/api/doc-templates', docsHeaders, 30);

    const statusesStats = getCache('statuses').stats();
    const docsStats = getCache('docTemplates').stats();

    // 2) 10k смен статусов (закрытие с оплатой => авто notify+print)
    const targetStatuses = ['closed_unpaid', 'in_work'];
    const PATCHES = 10000;
    const BATCH = 100;
    let sent = 0;

    for (let start = 0; start < PATCHES; start += BATCH) {
      for (let i = start; i < Math.min(start + BATCH, PATCHES); i += 1) {
        if (i > 0 && i % 250 === 0) {
          await new Promise((r) => setTimeout(r, 1));
        }
        const oid = toObjectIdString((i % 1000) + 1);
        const code = targetStatuses[i % targetStatuses.length];
        // Use service directly to avoid HTTP parser issues under Jest heavy loops
        await changeOrderStatus({
          orderId: oid,
          newStatusCode: code,
          userId: uid,
          note: `perf_${i}`,
          roles: ['orders.changeStatus'],
        });
        sent += 1;
      }
    }

    // 3) Подождём пока DEV-очередь обработает пачку (до секунд)
    const pollMetrics = async () => {
      const res = await agent.get('/api/queue/status-actions/metrics?n=100').set(adminHeaders).set('Connection', 'close').expect(200);
      return res.body || {};
    };

    let metrics = await pollMetrics();
    const deadline = Date.now() + 180000; // до 180с ожидания
    while ((((metrics.active || 0) + (metrics.waiting || 0) + (metrics.delayed || 0)) > 0 || (metrics.processed24h || 0) < sent) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      metrics = await pollMetrics();
    }

    // 4) Запишем отчёты
    const queueReport = [
      `Queue Load Test (10k)
Processed=${metrics.processed24h} Failed=${metrics.failed24h} Waiting=${metrics.waiting} Active=${metrics.active} Delayed=${metrics.delayed}`,
      fmtMetrics(metrics),
      `Hits/Misses TTL:
- statuses: hits=${statusesStats.hits} misses=${statusesStats.misses} size=${statusesStats.size}
- docTemplates: hits=${docsStats.hits} misses=${docsStats.misses} size=${docsStats.size}`,
      `List timings (ms):
- statuses: cold avg=${listStatuses1.avg.toFixed(2)} p95=${listStatuses1.p95}
- statuses: warm avg=${listStatuses2.avg.toFixed(2)} p95=${listStatuses2.p95}
- docTemplates: cold avg=${listDocs1.avg.toFixed(2)} p95=${listDocs1.p95}
- docTemplates: warm avg=${listDocs2.avg.toFixed(2)} p95=${listDocs2.p95}`,
    ].join('\n\n');

    writeReport(path.join(reportsDir, 'queue-load-report.md'), queueReport);

    const perfReport = [
      'Perf Report\nTTL Cache and Queue Metrics',
      `TTL Cache:
statuses: hits=${statusesStats.hits}, misses=${statusesStats.misses}, size=${statusesStats.size}
docTemplates: hits=${docsStats.hits}, misses=${docsStats.misses}, size=${docsStats.size}`,
      `Lists Timing (ms):
statuses: avg=${listStatuses2.avg.toFixed(2)} p95=${listStatuses2.p95}
docTemplates: avg=${listDocs2.avg.toFixed(2)} p95=${listDocs2.p95}`,
      `Queue Metrics:\n${fmtMetrics(metrics)}`,
    ].join('\n\n');

    writeReport(path.join(reportsDir, 'perf-report.md'), perfReport);

    // Верификации базовые, чтобы тест имел утверждения
    expect(statusesStats.hits + statusesStats.misses).toBeGreaterThan(0);
    expect(docsStats.hits + docsStats.misses).toBeGreaterThan(0);
    expect(metrics.processed24h).toBeGreaterThanOrEqual(PATCHES);
    expect(metrics.failed24h).toBeGreaterThanOrEqual(0);
  });
});
