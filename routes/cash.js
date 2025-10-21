const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

let CashRegister; try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// In-memory store for DEV mode (no MongoDB)
const memStore = { items: [] }; // {_id, code, name, defaultForLocation, cashierMode, isSystem}

function normalizeCode(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : v;
}

// GET /api/cash — list with pagination (cash.read)
router.get('/', requirePermission('cash.read'), async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = memStore.items
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .slice(offset, offset + limit);
    return res.json({ ok: true, items });
  }
  if (!CashRegister) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await CashRegister.find()
      .sort({ code: 1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/cash — create (cash.write), code unique
router.post('/', requirePermission('cash.write'), validate(schemas.cashCreateSchema), async (req, res) => {
  const body = req.body || {};

  const code = normalizeCode(body.code);
  const name = body.name && String(body.name).trim();
  const defaultForLocation = !!body.defaultForLocation;
  const cashierMode = body.cashierMode || 'open';
  const isSystem = !!body.isSystem;

  if (DEV_MODE && !mongoReady()) {
    if (memStore.items.some((i) => i.code === code)) return res.status(409).json({ error: 'CODE_EXISTS' });
    const item = {
      _id: new mongoose.Types.ObjectId(),
      code,
      name,
      defaultForLocation,
      cashierMode,
      isSystem,
    };
    memStore.items.push(item);
    return res.status(201).json({ ok: true, item });
  }
  if (!CashRegister) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const created = await CashRegister.create({ code, name, defaultForLocation, cashierMode, isSystem });
    const item = await CashRegister.findById(created._id).lean();
    return res.status(201).json({ ok: true, item });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    if (err && err.name === 'ValidationError') return res.status(400).json({ error: 'VALIDATION_ERROR' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// PATCH /api/cash/:id — partial update (cash.write); forbid changing code if isSystem=true
router.patch('/:id', requirePermission('cash.write'), validate(schemas.cashPatchSchema), async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};

  if (typeof patch.code === 'string') patch.code = normalizeCode(patch.code);

  if (DEV_MODE && !mongoReady()) {
    const idx = memStore.items.findIndex((i) => String(i._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    const current = memStore.items[idx];
    if (typeof patch.code === 'string' && current.isSystem && patch.code !== current.code) {
      return res.status(409).json({ error: 'SYSTEM_CODE_PROTECTED' });
    }
    if (typeof patch.code === 'string') {
      const dup = memStore.items.find((i) => i.code === patch.code && String(i._id) !== String(id));
      if (dup) return res.status(409).json({ error: 'CODE_EXISTS' });
    }
    const next = { ...current, ...patch };
    memStore.items[idx] = next;
    return res.json({ ok: true, item: next });
  }
  if (!CashRegister) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const current = await CashRegister.findById(id).lean();
    if (!current) return res.status(404).json({ error: 'NOT_FOUND' });

    if (typeof patch.code === 'string' && current.isSystem && patch.code !== current.code) {
      return res.status(409).json({ error: 'SYSTEM_CODE_PROTECTED' });
    }

    const item = await CashRegister.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    if (err && err.name === 'ValidationError') return res.status(400).json({ error: 'VALIDATION_ERROR' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// DELETE /api/cash/:id — forbid if has payments (cash.write)
router.delete('/:id', requirePermission('cash.write'), async (req, res) => {
  const { id } = req.params;

  if (DEV_MODE && !mongoReady()) {
    const idx = memStore.items.findIndex((i) => String(i._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    // In dev fallback we do not check payments
    memStore.items.splice(idx, 1);
    return res.json({ ok: true });
  }
  if (!CashRegister) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const current = await CashRegister.findById(id).lean();
    if (!current) return res.status(404).json({ error: 'NOT_FOUND' });

    try {
      await CashRegister.deleteOne({ _id: id });
    } catch (e) {
      if (e && /CASH_REGISTER_HAS_PAYMENTS/.test(String(e.message || ''))) {
        return res.status(409).json({ error: 'CASH_IN_USE' });
      }
      throw e;
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;