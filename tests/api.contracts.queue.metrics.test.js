const request = require('supertest');
const express = require('express');
const { queueMetricsResponseSchema } = require('../contracts/apiContracts');

function joiOk(schema, payload, { allowUnknown = true } = {}) {
  const { error } = schema.validate(payload, { allowUnknown });
  if (error) throw new Error(error.message);
}

function makeApp() {
  const app = express();
  const { withUser } = require('../middleware/auth');
  app.use(withUser);
  app.use('/api/queue', require('../routes/queue'));
  const errorHandler = require('../middleware/error');
  app.use(errorHandler);
  return app;
}

describe('API Contracts: GET /api/queue/status-actions/metrics', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('returns raw metrics object per schema', async () => {
    process.env.AUTH_DEV_MODE = '1';
    const app = makeApp();
    const res = await request(app)
      .get('/api/queue/status-actions/metrics')
      .set('x-user-role', 'Admin')
      .expect(200);
    joiOk(queueMetricsResponseSchema, res.body);
  });
});