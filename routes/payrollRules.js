const express = require('express');
const mongoose = require('mongoose');
const { requireRoles } = require('../middleware/auth');

let PayrollRule; try { PayrollRule = require('../server/models/PayrollRule'); } catch (e) {}

const router = express.Router();
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);

// DEV in-memory store
const devRules = [];
let devSeq = 1;
const nextId = () => String(devSeq++);

// GET /api/payroll/rules — list
router.get('/rules', requireRoles('Admin', 'Manager'), async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = devRules.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(offset, offset+limit);
    return res.json({ ok: true, items });
  }

  if (!PayrollRule) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await PayrollRule.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/payroll/rules — create
router.post('/rules', requireRoles('Admin', 'Manager'), async (req, res) => {
  const body = req.body || {};
  const payload = {
    code: body.code ? String(body.code) : undefined,
    name: body.name ? String(body.name) : undefined,
    scope: String(body.scope || ''),
    base: String(body.base || ''),
    source: String(body.source || ''),
    target: String(body.target || ''),
    value: Number(body.value || 0),
    active: body.active !== undefined ? !!body.active : true,
    conditions: body.conditions && typeof body.conditions === 'object' ? body.conditions : undefined,
  };

  if (DEV_MODE && !mongoReady()) {
    const id = nextId();
    const nowIso = new Date().toISOString();
    devRules.push({ _id: id, ...payload, createdAt: nowIso, updatedAt: nowIso });
    return res.status(201).json({ ok: true, id });
  }

  if (!PayrollRule) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const created = await PayrollRule.create(payload);
    return res.status(201).json({ ok: true, id: created._id });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// PATCH /api/payroll/rules/:id — update
router.patch('/rules/:id', requireRoles('Admin', 'Manager'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const body = req.body || {};

  if (DEV_MODE && !mongoReady()) {
    const idx = devRules.findIndex((r) => String(r._id) === id);
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    const nowIso = new Date().toISOString();
    devRules[idx] = { ...devRules[idx], ...body, updatedAt: nowIso };
    return res.json({ ok: true });
  }

  if (!PayrollRule) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    await PayrollRule.findByIdAndUpdate(id, body, { new: true });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// DELETE /api/payroll/rules/:id — delete
router.delete('/rules/:id', requireRoles('Admin'), async (req, res) => {
  const id = String(req.params.id || '').trim();

  if (DEV_MODE && !mongoReady()) {
    const idx = devRules.findIndex((r) => String(r._id) === id);
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    devRules.splice(idx, 1);
    return res.json({ ok: true });
  }

  if (!PayrollRule) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    await PayrollRule.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;