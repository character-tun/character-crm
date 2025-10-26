const request = require('supertest');
const express = require('express');

// Mock OrderStatus model to avoid real mongoose operations
jest.mock('../models/OrderStatus', () => ({
  GROUPS: ['draft', 'in_progress', 'closed_success', 'closed_fail'],
  find: jest.fn(),
  create: jest.fn(async (doc) => ({ ...doc, _id: `os_${Date.now()}` })),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  exists: jest.fn(),
}));

// DEV mode and cache TTL
process.env.AUTH_DEV_MODE = '1';
process.env.CACHE_TTL_SECS = process.env.CACHE_TTL_SECS || '60';

const { resetAll } = require('../services/ttlCache');

function makeAppStatuses() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/statuses', require('../routes/statuses'));
  app.use(require('../middleware/error'));
  return app;
}

function makeAppDocs() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/doc-templates', require('../routes/docTemplates'));
  app.use(require('../middleware/error'));
  return app;
}

describe('TTL cache e2e — statuses & doc-templates', () => {
  beforeEach(() => {
    resetAll();
    jest.clearAllMocks();
  });

  test('GET /api/statuses — second request served from cache (hit)', async () => {
    const app = makeAppStatuses();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const t0 = Date.now();
    const r1 = await request(app)
      .get('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:list');
    const d1 = Date.now() - t0;

    expect(r1.status).toBe(200);
    expect(Array.isArray(r1.body)).toBe(true);

    const t1 = Date.now();
    const r2 = await request(app)
      .get('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:list');
    const d2 = Date.now() - t1;

    expect(r2.status).toBe(200);
    // Cache hit logged
    const logs = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logs).toMatch(/\[cache:statuses\] hit key=list/);
    // Best-effort: second call should not be slower than first
    expect(d2).toBeLessThanOrEqual(d1);

    logSpy.mockRestore();
  });

  test('GET /api/statuses — cache invalidated after POST', async () => {
    const app = makeAppStatuses();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Warm cache
    await request(app)
      .get('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:list');

    // Mutate: create new status (mocked OrderStatus.create avoids DB)
    const payload = { code: 'custom_status', name: 'X', color: '#000000', group: 'in_progress', order: 1, actions: [] };
    const rCreate = await request(app)
      .post('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:create')
      .send(payload);
    expect(rCreate.status).toBe(201);

    // Next GET should be cache miss and then re-populate
    const rMiss = await request(app)
      .get('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:list');
    expect(rMiss.status).toBe(200);
    const logs = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logs).toMatch(/\[cache:statuses\] invalidateAll/);
    expect(logs).toMatch(/\[cache:statuses\] miss key=list/);

    // Subsequent should be hit
    const rHit = await request(app)
      .get('/api/statuses')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.statuses:list');
    expect(rHit.status).toBe(200);
    const logs2 = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logs2).toMatch(/\[cache:statuses\] hit key=list/);

    logSpy.mockRestore();
  });

  test('GET /api/doc-templates — hit after warm, miss after POST', async () => {
    const app = makeAppDocs();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // First call warms cache
    const r1 = await request(app)
      .get('/api/doc-templates')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.docs:*');
    expect(r1.status).toBe(200);

    // Second call should hit cache
    const r2 = await request(app)
      .get('/api/doc-templates')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.docs:*');
    expect(r2.status).toBe(200);
    const logsHit = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logsHit).toMatch(/\[cache:docTemplates\] hit key=list/);

    // Mutate: create template
    const payload = { code: 'tpl_x', name: 'Doc X', bodyHtml: '<h1>Hi</h1>', variables: [] };
    const rCreate = await request(app)
      .post('/api/doc-templates')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.docs:*')
      .send(payload);
    expect(rCreate.status).toBe(200);

    // Next GET should be miss, then hit
    const rMiss = await request(app)
      .get('/api/doc-templates')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.docs:*');
    expect(rMiss.status).toBe(200);
    const logsMiss = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logsMiss).toMatch(/\[cache:docTemplates\] invalidateAll/);
    expect(logsMiss).toMatch(/\[cache:docTemplates\] miss key=list/);

    const rHit = await request(app)
      .get('/api/doc-templates')
      .set('x-user-id', 'u1')
      .set('x-user-role', 'settings.docs:*');
    expect(rHit.status).toBe(200);
    const logsFinal = logSpy.mock.calls.map((c) => String(c[0] || '')).join('\n');
    expect(logsFinal).toMatch(/\[cache:docTemplates\] hit key=list/);

    logSpy.mockRestore();
  });
});
