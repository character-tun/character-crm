const express = require('express');

const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const UserToken = require('../models/UserToken');

const ACCESS_TTL_MINUTES = 15; // 15 minutes
const REFRESH_TTL_DAYS = 30; // 30 days
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// DEV MODE: allow auth without MongoDB
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const DEV_USER = {
  _id: 'dev-user-1',
  email: process.env.AUTH_DEV_EMAIL || 'admin@localhost',
  full_name: 'Администратор',
  is_active: true,
};
const DEV_PASSWORD = process.env.AUTH_DEV_PASSWORD || 'admin';
const DEV_REFRESH_STORE = new Set();

const signAccess = (user, roles) => {
  const payload = {
    id: user._id, email: user.email, roles, role: roles && roles.length ? roles[0] : 'manager',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${ACCESS_TTL_MINUTES}m` });
};

const getUserRoles = async (userId) => {
  const relations = await UserRole.find({ user_id: userId }).lean();
  if (!relations.length) return [];
  const roleIds = relations.map((r) => r.role_id);
  const roles = await Role.find({ _id: { $in: roleIds } }).lean();
  return roles.map((r) => r.code);
};

const sanitizeUser = (u, roles) => ({ id: u._id, email: u.email, roles });

const buildLoginResponse = (user, roles, accessToken, refreshToken) => ({
  ok: true,
  accessToken,
  access: accessToken,
  refreshToken,
  refresh: refreshToken,
  user: sanitizeUser(user, roles),
});

const handleRegisterFirst = async (req, res) => {
  try {
    if (DEV_MODE) {
      return res.status(201).json({ ok: true, user: sanitizeUser(DEV_USER, ['Admin']) });
    }
    const exists = await User.countDocuments();
    if (exists > 0) return res.status(400).json({ ok: false, error: 'USERS_ALREADY_EXIST' });

    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ ok: false, error: 'email, password, name are required' });
    }
    const pass_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email, pass_hash, full_name: name, is_active: true,
    });

    // Ensure Admin role exists
    let adminRole = await Role.findOne({ code: 'Admin' }).lean();
    if (!adminRole) {
      adminRole = await Role.create({ code: 'Admin', name: 'Администратор' });
    }
    await UserRole.updateOne(
      { user_id: user._id, role_id: adminRole._id },
      { $setOnInsert: { user_id: user._id, role_id: adminRole._id } },
      { upsert: true },
    );

    const roles = await getUserRoles(user._id);
    return res.status(201).json({ ok: true, user: sanitizeUser(user, roles) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// POST /auth/bootstrap-admin
router.post('/bootstrap-admin', async (req, res) => handleRegisterFirst(req, res));

// POST /auth/register-first
router.post('/register-first', async (req, res) => handleRegisterFirst(req, res));

// GET /auth/register-first — проверить, существуют ли пользователи
router.get('/register-first', async (req, res) => {
  try {
    if (DEV_MODE) {
      return res.json({ ok: true, usersExist: false });
    }
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ ok: false, error: 'USERS_ALREADY_EXIST', usersExist: true });
    return res.json({ ok: true, usersExist: false });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// HEAD /auth/register-first — статус без тела
router.head('/register-first', async (req, res) => {
  try {
    if (DEV_MODE) return res.status(200).end();
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).end();
    return res.status(200).end();
  } catch (err) {
    return res.status(500).end();
  }
});

// Lightweight DEV rate limiter (per IP/account) — for local/dev usage
const RATE_WINDOW_MS = 60 * 1000; // 1 minute window
const LOGIN_LIMIT = parseInt(process.env.AUTH_LOGIN_LIMIT || '5', 10);
const REFRESH_LIMIT = parseInt(process.env.AUTH_REFRESH_LIMIT || '10', 10);
const limiterState = {
  login: new Map(),
  refresh: new Map(),
};
const allowWithinWindow = (map, key, limit) => {
  const now = Date.now();
  let bucket = map.get(key) || [];
  bucket = bucket.filter((ts) => now - ts < RATE_WINDOW_MS);
  if (bucket.length >= limit) {
    map.set(key, bucket);
    const retryAfterMs = RATE_WINDOW_MS - (now - bucket[0]);
    return { ok: false, retryAfterMs };
  }
  bucket.push(now);
  map.set(key, bucket);
  return { ok: true };
};
const rateLimitLogin = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  const email = (req.body && req.body.email) || '';
  const key = `${ip}|${email}`;
  const { ok, retryAfterMs } = allowWithinWindow(limiterState.login, key, LOGIN_LIMIT);
  if (!ok) return res.status(429).json({ ok: false, error: 'RATE_LIMIT', retryAfterMs });
  next();
};
const rateLimitRefresh = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  const refresh = (req.body && req.body.refresh) || '';
  const key = `${ip}|${String(refresh).slice(0, 8)}`;
  const { ok, retryAfterMs } = allowWithinWindow(limiterState.refresh, key, REFRESH_LIMIT);
  if (!ok) return res.status(429).json({ ok: false, error: 'RATE_LIMIT', retryAfterMs });
  next();
};

// POST /auth/login
router.post('/login', rateLimitLogin, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password are required' });

    if (DEV_MODE) {
      if (email !== DEV_USER.email || password !== DEV_PASSWORD) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }
      const roles = ['Admin'];
      const accessToken = signAccess(DEV_USER, roles);
      const refreshToken = uuidv4();
      DEV_REFRESH_STORE.add(refreshToken);
      return res.json(buildLoginResponse(DEV_USER, roles, accessToken, refreshToken));
    }

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    if (user.is_active === false) return res.status(403).json({ ok: false, error: 'User is disabled' });
    if (!user.pass_hash) return res.status(400).json({ ok: false, error: 'Password not set for user' });

    const ok = await bcrypt.compare(password, user.pass_hash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const roles = await getUserRoles(user._id);
    const accessToken = signAccess(user, roles);

    const refreshToken = uuidv4();
    const expires_at = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    const user_agent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.ip || '';
    await UserToken.create({
      user_id: user._id, refresh_token: refreshToken, user_agent, ip, expires_at,
    });

    return res.json(buildLoginResponse(user, roles, accessToken, refreshToken));
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /auth/refresh
router.post('/refresh', rateLimitRefresh, async (req, res) => {
  try {
    const { refresh } = req.body || {};
    if (!refresh) return res.status(400).json({ ok: false, error: 'refresh is required' });

    if (DEV_MODE) {
      if (!DEV_REFRESH_STORE.has(refresh)) {
        return res.status(401).json({ ok: false, error: 'Invalid refresh token' });
      }
      const roles = ['Admin'];
      const accessToken = signAccess(DEV_USER, roles);
      return res.json({ ok: true, accessToken, access: accessToken });
    }

    const rec = await UserToken.findOne({ refresh_token: refresh }).lean();
    if (!rec) return res.status(401).json({ ok: false, error: 'Invalid refresh token' });
    if (new Date(rec.expires_at).getTime() < Date.now()) {
      await UserToken.deleteOne({ _id: rec._id });
      return res.status(401).json({ ok: false, error: 'Refresh token expired' });
    }

    const user = await User.findById(rec.user_id).lean();
    if (!user || user.is_active === false) {
      await UserToken.deleteOne({ _id: rec._id });
      return res.status(401).json({ ok: false, error: 'User invalidated' });
    }

    const roles = await getUserRoles(user._id);
    const accessToken = signAccess(user, roles);
    return res.json({ ok: true, accessToken, access: accessToken });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refresh } = req.body || {};
    if (!refresh) return res.status(400).json({ error: 'refresh is required' });

    if (DEV_MODE) {
      DEV_REFRESH_STORE.delete(refresh);
      return res.json({ ok: true });
    }

    await UserToken.deleteOne({ refresh_token: refresh });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
