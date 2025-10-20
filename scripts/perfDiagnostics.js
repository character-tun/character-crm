/*
 Basic performance diagnostics:
 - Measures p50/p95 latencies for key routes
 - Runs 200 parallel PATCH /api/orders/:id/status (DEV branch) and checks for deadlocks
 - Prints recommendations on indexes, caching, batching

 Usage: node scripts/perfDiagnostics.js
*/

process.env.AUTH_DEV_MODE = process.env.AUTH_DEV_MODE || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');


function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);

  // Mount routes with DEV fallbacks
  app.use('/api/statuses', require('../routes/statuses'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/queue', require('../routes/queue'));

  // Error handler
  app.use(require('../middleware/error'));
  return app;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function measure(app, label, factory, iterations = 200, concurrent = 1) {
  const times = [];
  const errors = [];
  const runOne = async () => {
    const start = process.hrtime.bigint();
    try {
      await factory();
    } catch (e) {
      errors.push(e);
    } finally {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      times.push(ms);
    }
  };

  for (let i = 0; i < iterations; i += concurrent) {
    const batch = [];
    for (let j = 0; j < concurrent && (i + j) < iterations; j += 1) {
      batch.push(runOne());
    }
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(batch);
  }

  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  return { label, p50: Math.round(p50), p95: Math.round(p95), count: times.length, errors: errors.length };
}

async function main() {
  const app = makeApp();

  // Default headers (DEV auth)
  const headers = {
    'x-user-id': 'u1',
    'x-user-role': 'Admin',
    'x-user-email': 'admin@local',
    'x-user-name': 'Admin',
  };

  const results = [];

  // 1) CRUD simple: GET /api/statuses
  results.push(await measure(app, 'GET /api/statuses', async () => {
    await request(app)
      .get('/api/statuses')
      .set({ ...headers, 'x-user-role': 'settings.statuses:list' })
      .expect(200);
  }, 200, 1));

  // 1) CRUD simple: GET /api/doc-templates
  results.push(await measure(app, 'GET /api/doc-templates', async () => {
    await request(app)
      .get('/api/doc-templates')
      .set({ ...headers, 'x-user-role': 'settings.docs:*' })
      .expect(200);
  }, 200, 1));

  // 1) CRUD simple: POST /api/doc-templates
  results.push(await measure(app, 'POST /api/doc-templates', async () => {
    const code = `tpl-${Math.random().toString(36).slice(2, 8)}`;
    await request(app)
      .post('/api/doc-templates')
      .set({ ...headers, 'x-user-role': 'settings.docs:*' })
      .send({ code, name: 'Test', bodyHtml: '<div/>', variables: [] })
      .expect(200);
  }, 100, 1));

  // 1) CRUD simple: GET /api/notify/templates
  results.push(await measure(app, 'GET /api/notify/templates', async () => {
    await request(app)
      .get('/api/notify/templates')
      .set({ ...headers, 'x-user-role': 'settings.notify:*' })
      .expect(200);
  }, 200, 1));

  // 1) Heavy: PATCH /api/orders/:id/status (DEV)
  results.push(await measure(app, 'PATCH /api/orders/:id/status', async () => {
    await request(app)
      .patch('/api/orders/ord-1/status')
      .set({ ...headers, 'x-user-role': 'orders.changeStatus' })
      .send({ newStatusCode: 'in_work', userId: 'u1' })
      .expect(200);
  }, 200, 1));

  // 3) Load mini-test: 200 parallel PATCH /status
  const parallelCount = 200;
  const startAll = process.hrtime.bigint();
  const promises = new Array(parallelCount).fill(0).map((_, i) => (
    request(app)
      .patch(`/api/orders/ord-${i}/status`)
      .set({ ...headers, 'x-user-role': 'orders.changeStatus' })
      .send({ newStatusCode: i % 2 === 0 ? 'in_work' : 'closed_unpaid', userId: 'u1' })
      .expect(200)
  ));
  await Promise.all(promises);
  const endAll = process.hrtime.bigint();
  const totalMs = Math.round(Number(endAll - startAll) / 1e6);

  // Read queue metrics after load
  const metricsRes = await request(app)
    .get('/api/queue/status-actions/metrics?n=20')
    .set({ ...headers, 'x-user-role': 'Admin' })
    .expect(200);
  const metrics = metricsRes.body;

  const report = {
    targets: {
      crud: '<200ms',
      heavy: '<500ms',
    },
    latencies: results,
    load: {
      parallelPatchCount: parallelCount,
      totalTimeMs: totalMs,
      queue: metrics,
    },
    recommendations: [
      'Индексы: Orders — составной индекс (status, statusChangedAt) добавлен в модель',
      'Кэширование: подумать про кэш GET /api/statuses, /api/doc-templates при стабильных данных (TTL 30–60s)',
      'Батчи: использовать PATCH /api/statuses/reorder для массовых изменений, избегать N одиночных запросов',
      'Очередь: heavy-операции оставлять асинхронными; не ждать выполнения в HTTP-обработчике',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
  // Persist report to storage/reports (timestamped + latest)
  const dir = path.join(__dirname, '..', 'storage', 'reports');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const ts = new Date().toISOString().replace(/:/g, '-');
  const fileTs = path.join(dir, `perf-report-${ts}.json`);
  const fileLatest = path.join(dir, 'perf-report-latest.json');
  try {
    fs.writeFileSync(fileTs, JSON.stringify(report, null, 2));
    fs.writeFileSync(fileLatest, JSON.stringify(report, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist perf report:', e);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('perfDiagnostics error', e);
  process.exit(1);
});