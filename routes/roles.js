const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

// DEV auth mode: enable in-memory roles store when AUTH_DEV_MODE=1
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mem = { roles: [], idSeq: 1 };
const nextId = () => `R-${mem.idSeq++}`;

// List roles
router.get('/', async (req, res) => {
  try {
    if (DEV_MODE) {
      return res.json(mem.roles);
    }
    const roles = await Role.find({}).lean();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get role by id
router.get('/:id', async (req, res) => {
  try {
    if (DEV_MODE) {
      const role = mem.roles.find((r) => r._id === req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      return res.json(role);
    }
    const role = await Role.findById(req.params.id).lean();
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create role
router.post('/', async (req, res) => {
  try {
    const { code, name } = req.body || {};
    if (DEV_MODE) {
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const exists = mem.roles.find((r) => r.code === code);
      if (exists) return res.status(409).json({ error: 'Role code already exists' });
      const created = { _id: nextId(), code, name };
      mem.roles.unshift(created);
      return res.status(201).json(created);
    }
    const created = await Role.create({ code, name });
    res.status(201).json(created);
  } catch (err) {
    if (!DEV_MODE && err && err.code === 11000) {
      return res.status(409).json({ error: 'Role code already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// Update role (only name is editable)
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (DEV_MODE) {
      const idx = mem.roles.findIndex((r) => r._id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Role not found' });
      const updated = { ...mem.roles[idx], name };
      mem.roles[idx] = updated;
      return res.json(updated);
    }
    const updated = await Role.findByIdAndUpdate(
      req.params.id,
      { $set: { name } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Role not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete role (prevent if used by any user)
router.delete('/:id', async (req, res) => {
  try {
    if (DEV_MODE) {
      const idx = mem.roles.findIndex((r) => r._id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Role not found' });
      mem.roles.splice(idx, 1);
      return res.json({ ok: true });
    }
    const used = await UserRole.countDocuments({ role_id: req.params.id });
    if (used > 0) {
      return res.status(409).json({ error: 'Role is used by users' });
    }
    const deleted = await Role.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Role not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;