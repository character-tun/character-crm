const request = require('supertest');
const express = require('express');

// In-memory stores to simulate DB branch (AUTH_DEV_MODE=0)
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
      if (query._id) {
        mem.tokens = mem.tokens.filter((t) => t._id !== query._id);
      }
      if (query.refresh_token) {
        mem.tokens = mem.tokens.filter((t) => t.refresh_token !== query.refresh_token);
      }
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

describe('Auth e2e: register-first + login', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '0';
    process.env.JWT_SECRET = 'test_secret';
    mem = { users: [], roles: [], userRoles: [], tokens: [] };
    setupMocks();
  });

  test('POST /api/auth/register-first → 201, then /login → tokens + duplicates', async () => {
    const app = makeApp();

    const reg = await request(app)
      .post('/api/auth/register-first')
      .send({ email: 'first@example.com', password: 's3cret', name: 'First User' });
    expect(reg.status).toBe(201);
    expect(reg.body && reg.body.ok).toBe(true);
    expect(reg.body && reg.body.user && reg.body.user.email).toBe('first@example.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'first@example.com', password: 's3cret' });
    expect(login.status).toBe(200);
    expect(login.body && login.body.ok).toBe(true);
    expect(typeof login.body.accessToken).toBe('string');
    expect(login.body.access).toBe(login.body.accessToken);
    expect(typeof login.body.refreshToken).toBe('string');
    expect(login.body.refresh).toBe(login.body.refreshToken);
    expect(Array.isArray(login.body.user.roles)).toBe(true);
    expect(login.body.user.roles).toContain('Admin');
  });

  test('Repeat POST /api/auth/register-first → 400 USERS_ALREADY_EXIST', async () => {
    const app = makeApp();

    let res = await request(app)
      .post('/api/auth/register-first')
      .send({ email: 'first@example.com', password: 's3cret', name: 'First User' });
    expect(res.status).toBe(201);

    res = await request(app)
      .post('/api/auth/register-first')
      .send({ email: 'second@example.com', password: 'pass2', name: 'Second User' });
    expect(res.status).toBe(400);
    expect(res.body && res.body.error).toBe('USERS_ALREADY_EXIST');
  });
});