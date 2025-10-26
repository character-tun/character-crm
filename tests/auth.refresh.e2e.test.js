const request = require('supertest');
const express = require('express');

let mem;

function setupMocks() {
  jest.doMock('../models/User', () => ({
    countDocuments: jest.fn(async () => mem.users.length),
    create: jest.fn(async ({ email, pass_hash, full_name, is_active }) => {
      const u = { _id: `u_${mem.users.length + 1}`, email, pass_hash, full_name, is_active };
      mem.users.push(u);
      return u;
    }),
    findOne: jest.fn((query) => ({
      lean: jest.fn().mockResolvedValue(mem.users.find((u) => u.email === query.email) || null),
    })),
    findById: jest.fn((id) => ({
      lean: jest.fn().mockResolvedValue(mem.users.find((u) => u._id === id) || null),
    })),
  }));

  jest.doMock('../models/Role', () => ({
    findOne: jest.fn((query) => ({
      lean: jest.fn().mockResolvedValue(mem.roles.find((r) => r.code === query.code) || null),
    })),
    create: jest.fn(async ({ code, name }) => {
      const r = { _id: `r_${code}`, code, name };
      mem.roles.push(r);
      return r;
    }),
    find: jest.fn((query) => ({
      lean: jest.fn().mockResolvedValue(mem.roles.filter((r) => (query._id && query._id.$in ? query._id.$in.includes(r._id) : true))),
    })),
  }));

  jest.doMock('../models/UserRole', () => ({
    find: jest.fn((query) => ({
      lean: jest.fn().mockResolvedValue(mem.userRoles.filter((r) => r.user_id === query.user_id)),
    })),
    updateOne: jest.fn(async (filter) => {
      const exists = mem.userRoles.find((r) => r.user_id === filter.user_id && r.role_id === filter.role_id);
      if (!exists) mem.userRoles.push({ user_id: filter.user_id, role_id: filter.role_id });
      return { acknowledged: true };
    }),
  }));

  jest.doMock('../models/UserToken', () => ({
    create: jest.fn(async ({ user_id, refresh_token, user_agent, ip, expires_at }) => {
      const rec = { _id: `t_${mem.tokens.length + 1}`, user_id, refresh_token, user_agent, ip, expires_at };
      mem.tokens.push(rec);
      return rec;
    }),
    findOne: jest.fn((query) => ({
      lean: jest.fn().mockResolvedValue(mem.tokens.find((t) => t.refresh_token === query.refresh_token) || null),
    })),
    deleteOne: jest.fn(async (query) => {
      if (query._id) mem.tokens = mem.tokens.filter((t) => t._id !== query._id);
      if (query.refresh_token) mem.tokens = mem.tokens.filter((t) => t.refresh_token !== query.refresh_token);
      return { acknowledged: true };
    }),
  }));

  jest.doMock('bcryptjs', () => ({
    hash: jest.fn(async (str) => `hash:${str}`),
    compare: jest.fn(async (password, hash) => hash === `hash:${password}`),
  }));
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use(require('../middleware/error'));
  return app;
}

describe('Auth e2e: refresh token flow', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '0';
    process.env.JWT_SECRET = 'test_secret';
    mem = { users: [], roles: [], userRoles: [], tokens: [] };
    setupMocks();
  });

  test('Login → obtain refresh; POST /api/auth/refresh → new access + duplicates', async () => {
    const app = makeApp();

    // Register admin user
    let res = await request(app)
      .post('/api/auth/register-first')
      .send({ email: 'first@example.com', password: 's3cret', name: 'First User' });
    expect(res.status).toBe(201);

    // Login
    res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'first@example.com', password: 's3cret' });
    expect(res.status).toBe(200);
    const refresh = res.body && res.body.refreshToken;
    expect(typeof refresh).toBe('string');

    // Refresh
    res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh });
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.access).toBe(res.body.accessToken);
  });

  test('Invalid/expired refresh → 401 with error', async () => {
    const app = makeApp();

    // Register admin user to ensure route branch is DB
    let res = await request(app)
      .post('/api/auth/register-first')
      .send({ email: 'first@example.com', password: 's3cret', name: 'First User' });
    expect(res.status).toBe(201);

    // Attempt refresh with invalid token
    res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh: 'invalid-token' });
    expect(res.status).toBe(401);
    expect(res.body && res.body.ok).toBe(false);
    expect(typeof (res.body && res.body.error)).toBe('string');
  });
});
