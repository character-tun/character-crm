const request = require('supertest');
const express = require('express');

// Ensure DEV mode so we use in-memory queue
process.env.AUTH_DEV_MODE = '1';
process.env.QUEUE_FAIL_THRESHOLD = '2';
process.env.MEM_ATTEMPTS = '1';
process.env.MEM_BACKOFF_BASE_MS = '1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/queue', require('../routes/queue'));
  app.use(require('../middleware/error'));
  return app;
}

describe('GET /api/queue/status-actions/metrics (e2e, DEV mem-queue)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.QUEUE_FAIL_THRESHOLD = '2';
    process.env.MEM_ATTEMPTS = '1';
    process.env.MEM_BACKOFF_BASE_MS = '1';
  });

  test('failed jobs increase metrics and trigger WARNING', async () => {
    const app = makeApp();

    // Require queue after reset to ensure same module instance as route
    const { enqueueStatusActions } = require('../queues/statusActionQueue');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Enqueue several forced-fail jobs
    await enqueueStatusActions({
      orderId: 'o1', statusCode: 'X', actions: [], logId: 'l1', userId: 'u1', __forceFail: true,
    });
    await enqueueStatusActions({
      orderId: 'o2', statusCode: 'X', actions: [], logId: 'l2', userId: 'u1', __forceFail: true,
    });
    await enqueueStatusActions({
      orderId: 'o3', statusCode: 'X', actions: [], logId: 'l3', userId: 'u1', __forceFail: true,
    });

    // Allow worker to process
    await new Promise((r) => setTimeout(r, 200));

    const res = await request(app)
      .get('/api/queue/status-actions/metrics?n=2')
      .set('x-user-role', 'Admin')
      .expect(200);

    const { body } = res;
    expect(Array.isArray(body.failedLastN)).toBe(true);
    expect(body.failedLastN.length).toBe(2);
    expect(body.failed24h).toBeGreaterThanOrEqual(3);
    expect(body.failedLastHour).toBeGreaterThanOrEqual(3);

    // Warning should be logged when failedLastHour > threshold (2)
    const calls = warnSpy.mock.calls.map((args) => String(args[0]));
    expect(calls.some((m) => m.includes('[QUEUE][WARNING]'))).toBe(true);

    warnSpy.mockRestore();
  });
});
