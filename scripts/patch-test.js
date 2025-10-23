process.env.AUTH_DEV_MODE = '1';
process.env.NODE_ENV = 'test';

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const request = require('supertest');

const { withUser } = require('../middleware/auth');
const ordersRoute = require('../routes/orders');
const statusesRoute = require('../routes/statuses');
const docTemplatesRoute = require('../routes/docTemplates');
const queueRoute = require('../routes/queue');
const errorHandler = require('../middleware/error');

// Minimal mocks
globalThis.__OrdersMem = new Map();
for (let i = 1; i <= 3; i++) {
  const id = String(i).padStart(24, '0');
  globalThis.__OrdersMem.set(id, { _id: id, status: 'new', closed: false, paymentsLocked: false, totals: { grandTotal: 1000 } });
}

jest = undefined; // allow running outside Jest

// Mocks of Order & OrderStatusLog when models are required by services
require.cache[require.resolve('../models/Order')] = {
  id: require.resolve('../models/Order'),
  filename: require.resolve('../models/Order'),
  loaded: true,
  exports: {
    findById: async (id) => {
      const o = globalThis.__OrdersMem.get(String(id));
      if (!o) return null;
      return {
        ...o,
        save: async function () { globalThis.__OrdersMem.set(String(this._id), this); return this; },
      };
    },
  },
};
require.cache[require.resolve('../models/OrderStatusLog')] = {
  id: require.resolve('../models/OrderStatusLog'),
  filename: require.resolve('../models/OrderStatusLog'),
  loaded: true,
  exports: { create: async (doc) => ({ _id: 'log_1', ...doc }) },
};

mongoose.connection.readyState = 0;
mongoose.connection.db = undefined;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(withUser);
  app.use('/api/statuses', statusesRoute);
  app.use('/api/doc-templates', docTemplatesRoute);
  app.use('/api/orders', ordersRoute);
  app.use('/api/queue', queueRoute);
  app.use(errorHandler);
  return app;
}

(async () => {
  try {
    const app = makeApp();
    const uid = '507f1f77bcf86cd799439011';
    const headers = { 'x-user-id': uid, 'x-user-role': 'orders.changeStatus' };
    const oid = '000000000000000000000001';

    const res = await request(app)
      .patch(`/api/orders/${oid}/status`)
      .set(headers)
      .send({ newStatusCode: 'in_work', note: 'smoke' });
    console.log('PATCH status result:', res.status, res.body);
  } catch (e) {
    console.error('PATCH status error:', e && e.message, e && e.stack);
    process.exit(1);
  }
})();