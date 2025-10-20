/* eslint camelcase: off */
const express = require('express');

const router = express.Router();
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const UserToken = require('../models/UserToken');
const { requireRole } = require('../middleware/auth');

// DEV auth mode: enable in-memory users store when AUTH_DEV_MODE=1
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mem = { users: [], idSeq: 1 };
const nextId = () => `U-${mem.idSeq++}`;

// Применяем Admin-only ко всем маршрутам
router.use(requireRole('Admin'));

const sanitizeUser = (user) => ({
  _id: user._id,
  email: user.email,
  full_name: user.full_name || '',
  is_active: !!user.is_active,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  roles: Array.isArray(user.roles) ? user.roles : [],
});

// List users (hide pass_hash)
router.get('/', async (req, res) => {
  try {
    if (DEV_MODE) {
      return res.json(mem.users.map(sanitizeUser));
    }
    const users = await User.find({}).select('email full_name is_active createdAt updatedAt').lean();
    return res.json(users.map(sanitizeUser));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user by id (hide pass_hash)
router.get('/:id', async (req, res) => {
  try {
    if (DEV_MODE) {
      const user = mem.users.find((u) => u._id === req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json(sanitizeUser(user));
    }
    const user = await User.findById(req.params.id).select('email full_name is_active createdAt updatedAt').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(sanitizeUser(user));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create user (pass_hash accepted but not returned)
router.post('/', async (req, res) => {
  try {
    const {
      email, pass_hash, full_name, is_active,
    } = req.body || {};
    if (DEV_MODE) {
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const duplicate = mem.users.find((u) => u.email === email);
      if (duplicate) return res.status(409).json({ error: 'Email already exists' });
      const now = new Date().toISOString();
      const created = {
        _id: nextId(), email, full_name: full_name || '', is_active: is_active !== false, createdAt: now, updatedAt: now, roles: [],
      };
      mem.users.unshift(created);
      return res.status(201).json(sanitizeUser(created));
    }
    const created = await User.create({
      email, pass_hash, full_name, is_active,
    });
    const lean = created.toObject();
    return res.status(201).json(sanitizeUser(lean));
  } catch (err) {
    if (!DEV_MODE && err && err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(400).json({ error: err.message });
  }
});

// Update user (do not allow editing pass_hash via this route)
router.put('/:id', async (req, res) => {
  try {
    const {
      email, full_name, is_active, roles,
    } = req.body || {};
    if (DEV_MODE) {
      const idx = mem.users.findIndex((u) => u._id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      const now = new Date().toISOString();
      const next = { ...mem.users[idx] };
      if (typeof email === 'string') next.email = email;
      if (typeof full_name === 'string') next.full_name = full_name;
      if (typeof is_active === 'boolean') next.is_active = is_active;
      if (Array.isArray(roles)) next.roles = roles;
      next.updatedAt = now;
      // email uniqueness check
      if (typeof email === 'string' && mem.users.some((u, i) => i !== idx && u.email === next.email)) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      mem.users[idx] = next;
      return res.json(sanitizeUser(next));
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { email, full_name, is_active } },
      { new: true, runValidators: true },
    ).select('email full_name is_active createdAt updatedAt').lean();
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json(sanitizeUser(updated));
  } catch (err) {
    if (!DEV_MODE && err && err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(400).json({ error: err.message });
  }
});

// Delete user and clean relations (UserRoles, UserTokens)
router.delete('/:id', async (req, res) => {
  try {
    if (DEV_MODE) {
      const idx = mem.users.findIndex((u) => u._id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      mem.users.splice(idx, 1);
      return res.json({ ok: true });
    }
    const deleted = await User.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    await Promise.all([
      UserRole.deleteMany({ user_id: req.params.id }),
      UserToken.deleteMany({ user_id: req.params.id }),
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
