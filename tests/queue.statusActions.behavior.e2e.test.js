const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Ensure DEV mode so we use in-memory queue
process.env.AUTH_DEV_MODE = '1';
process.env.NOTIFY_DRY_RUN = '1';
process.env.PRINT_DRY_RUN = '1';
process.env.MEM_ATTEMPTS = '3';
process.env.MEM_BACKOFF_BASE_MS = '50';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/queue', require('../routes/queue'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/notify/templates', require('../routes/notifyTemplates'));
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use(require('../middleware/error'));
  return app;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

describe('statusActionQueue behavior (e2e, DEV mem-queue)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';
    process.env.MEM_ATTEMPTS = '3';
    process.env.MEM_BACKOFF_BASE_MS = '50';
  });

  test('idempotency: same status change twice -> one job by jobId', async () => {
    const app = makeApp();
    const { enqueueStatusActions } = require('../queues/statusActionQueue');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const jobIdParams = { orderId: 'io-1', statusCode: 'in_work', actions: [], logId: 'same-log', userId: 'u1' };
    await enqueueStatusActions(jobIdParams);
    await enqueueStatusActions(jobIdParams);

    // Allow worker to process
    await new Promise((r) => setTimeout(r, 200));

    const res = await request(app)
      .get('/api/queue/status-actions/metrics?n=10')
      .set('x-user-role', 'Admin')
      .expect(200);

    const { body } = res;
    expect(body.processed24h).toBeGreaterThanOrEqual(1);
    // Ensure duplicate was prevented
    const calls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(calls.some((m) => m.includes('job already exists (mem)'))).toBe(true);

    logSpy.mockRestore();
  });

  test('retry/backoff: force notify/print fail -> attempts counted and in failedLastN', async () => {
    const app = makeApp();
    const { enqueueStatusActions } = require('../queues/statusActionQueue');

    const retryLogs = [];
    const logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      const msg = String(args[0]);
      if (msg.includes('retry scheduled')) retryLogs.push(args[1]);
    });

    await enqueueStatusActions({
      orderId: 'rt-1', statusCode: 'in_work', actions: [{ type: 'notify', templateId: 'tpl-not-exist' }], logId: 'rt-l1', userId: 'u1', __forceFail: true,
    });

    // Wait enough to go through all attempts (exponential backoff)
    await new Promise((r) => setTimeout(r, 1200));

    const res = await request(app)
      .get('/api/queue/status-actions/metrics?n=5')
      .set('x-user-role', 'Admin')
      .expect(200);
    const { body } = res;

    expect(Array.isArray(body.failedLastN)).toBe(true);
    const last = body.failedLastN[body.failedLastN.length - 1];
    expect(last && last.id).toBe('rt-1:in_work:rt-l1');
    expect(last && last.attempts).toBeGreaterThanOrEqual(3);
    expect(body.failedLastHour).toBeGreaterThanOrEqual(1);

    // Ensure we saw retries scheduled (attempts - 1 times)
    expect(retryLogs.length).toBeGreaterThanOrEqual(2);

    logSpy.mockRestore();
  });

  test('mini load: 100 orders × 2 actions -> no sticking, all completed', async () => {
    const app = makeApp();
    const TemplatesStore = require('../services/templatesStore');
    const notifyTpl = TemplatesStore.createNotifyTemplate({
      code: 'bulk-notify', name: 'Bulk Notify', channel: 'email', subject: 'Order {{order.id}}', bodyHtml: '<p>ID: {{order.id}}</p>', variables: ['order.id'],
    });
    const docTpl = TemplatesStore.createDocTemplate({
      code: 'bulk-doc', name: 'Bulk Doc', bodyHtml: '<h1>{{order.id}}</h1>', variables: ['order.id'],
    });

    const { enqueueStatusActions } = require('../queues/statusActionQueue');

    for (let i = 0; i < 100; i += 1) {
      const orderId = `lo-${i}`;
      const logId = `ll-${i}`;
      await enqueueStatusActions({
        orderId, statusCode: 'in_work', actions: [
          { type: 'notify', templateId: notifyTpl._id },
          { type: 'print', docId: docTpl._id },
        ], logId, userId: 'u-load',
      });
    }

    // Poll until done or timeout
    const start = Date.now();
    let metrics;
    while (Date.now() - start < 8000) {
      const res = await request(app)
        .get('/api/queue/status-actions/metrics?n=150')
        .set('x-user-role', 'Admin')
        .expect(200);
      metrics = res.body;
      if ((metrics.active === 0) && (metrics.waiting === 0) && (metrics.delayed === 0)) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(metrics).toBeTruthy();
    expect(metrics.active).toBe(0);
    expect(metrics.waiting).toBe(0);
    expect(metrics.delayed).toBe(0);
    expect(metrics.failed24h).toBe(0);
    expect(metrics.processed24h).toBeGreaterThanOrEqual(100);

    // Time report (p50/p95) from completedLastN durations
    const durations = Array.isArray(metrics.completedLastN) ? metrics.completedLastN.map((c) => c.durationMs).filter((d) => typeof d === 'number') : [];
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);

    // Save report artifact
    const reportDir = path.join(__dirname, '..', 'storage', 'reports');
    const fileName = `statusActionQueue-load-report-${new Date().toISOString().slice(0, 10)}.md`;
    const reportPath = path.join(reportDir, fileName);
    try { fs.mkdirSync(reportDir, { recursive: true }); } catch {}
    const md = [
      '# statusActionQueue Load Test Report',
      `Date: ${new Date().toISOString()}`,
      `Processed: ${metrics.processed24h}`,
      `Failed: ${metrics.failed24h}`,
      `Waiting: ${metrics.waiting}, Active: ${metrics.active}, Delayed: ${metrics.delayed}`,
      `Durations collected: ${durations.length}`,
      `p50 (ms): ${p50}`,
      `p95 (ms): ${p95}`,
    ].join('\n');
    fs.writeFileSync(reportPath, md, 'utf8');

    // Also log for visibility
    console.log('[statusActionQueue][REPORT]', { p50, p95, processed: metrics.processed24h });
  });
});
