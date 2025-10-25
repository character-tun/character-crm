const express = require('express');
const mongoose = require('mongoose');
const { requireRoles } = require('../middleware/auth');

let Employee; try { Employee = require('../server/models/Employee'); } catch (e) {}

const router = express.Router();
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);

// DEV in-memory store
const devEmployees = [];
let devSeq = 1;
const nextId = () => String(devSeq++);

// GET /api/employees — list
router.get('/', requireRoles('Admin', 'Manager'), async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = devEmployees.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(offset, offset+limit);
    return res.json({ ok: true, items });
  }

  if (!Employee) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await Employee.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/employees — create
router.post('/', requireRoles('Admin', 'Manager'), async (req, res) => {
  const body = req.body || {};
  const payload = {
    userId: body.userId ? String(body.userId) : undefined,
    roles: Array.isArray(body.roles) ? body.roles.map(String) : [],
    inn: body.inn ? String(body.inn) : undefined,
    locations: Array.isArray(body.locations) ? body.locations.map(String) : [],
    active: body.active !== undefined ? !!body.active : true,
  };

  if (DEV_MODE && !mongoReady()) {
    const id = nextId();
    const nowIso = new Date().toISOString();
    devEmployees.push({ _id: id, ...payload, createdAt: nowIso, updatedAt: nowIso });
    return res.status(201).json({ ok: true, id });
  }

  if (!Employee) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const created = await Employee.create(payload);
    return res.status(201).json({ ok: true, id: created._id });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// PUT /api/employees/:id — update
router.put('/:id', requireRoles('Admin', 'Manager'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const body = req.body || {};

  if (DEV_MODE && !mongoReady()) {
    const idx = devEmployees.findIndex((e) => String(e._id) === id);
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    const nowIso = new Date().toISOString();
    devEmployees[idx] = { ...devEmployees[idx], ...body, updatedAt: nowIso };
    return res.json({ ok: true });
  }

  if (!Employee) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    await Employee.findByIdAndUpdate(id, body, { new: true });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;