const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { requirePermission } = require('../middleware/auth');

const Order = require('../models/Order');
let OrderType; try { OrderType = require('../server/models/OrderType'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// In‑memory store for DEV mode (no MongoDB)
const memStore = {
  items: [], // {_id, code, name, startStatusId, allowedStatuses, fieldsSchemaId, docTemplateIds, isSystem, createdAt}
};

// DEV memory helpers
const useMem = () => DEV_MODE && !mongoReady();
function normalizeCode(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : v;
}
function memFindById(id) {
  return memStore.items.find((i) => String(i._id) === String(id)) || null;
}
function memFindByCode(code) {
  const c = normalizeCode(code);
  return memStore.items.find((i) => i.code === c) || null;
}
function memLean(i) {
  return i ? { ...i } : null;
}

function modelRegistered(name) {
  try {
    return !!mongoose.models[name];
  } catch (e) {
    return false;
  }
}

function buildPopulate() {
  const paths = [
    { path: 'startStatusId' },
    { path: 'allowedStatuses' },
    { path: 'docTemplateIds' },
  ];
  if (modelRegistered('FieldSchema')) paths.push({ path: 'fieldsSchemaId' });
  return paths;
}

function validateStartIncluded(patchOrDoc) {
  const start = patchOrDoc.startStatusId;
  if (!start) return true;
  const allowed = Array.isArray(patchOrDoc.allowedStatuses) ? patchOrDoc.allowedStatuses : [];
  return allowed.some((id) => String(id) === String(start));
}

// GET /api/order-types — list (orderTypes.read)
router.get('/', requirePermission('orderTypes.read'), async (req, res) => {
  if (useMem()) {
    return res.json({ ok: true, items: memStore.items.map((i) => memLean(i)) });
  }
  if (!OrderType) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const populate = buildPopulate();
    let q = OrderType.find();
    for (const p of populate) q = q.populate(p);
    const items = await q.lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// GET /api/order-types/:id — item (orderTypes.read)
router.get('/:id', requirePermission('orderTypes.read'), async (req, res) => {
  if (useMem()) {
    const item = memFindById(req.params.id);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item: memLean(item) });
  }
  if (!OrderType) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    let q = OrderType.findById(req.params.id);
    const populate = buildPopulate();
    for (const p of populate) q = q.populate(p);
    const item = await q.lean();
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/order-types — create (orderTypes.write)
router.post('/', requirePermission('orderTypes.write'), async (req, res) => {
  if (useMem()) {
    try {
      const body = req.body || {};
      const { code, name } = body;
      if (!code || !name) return res.status(400).json({ error: 'VALIDATION_ERROR' });
      body.code = normalizeCode(code);
      if (memFindByCode(body.code)) return res.status(409).json({ error: 'CODE_EXISTS' });
      if (!validateStartIncluded(body)) return res.status(400).json({ error: 'ORDERTYPE_INVALID_START_STATUS' });
      const _id = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        _id,
        code: body.code,
        name,
        startStatusId: body.startStatusId,
        allowedStatuses: Array.isArray(body.allowedStatuses) ? body.allowedStatuses : [],
        fieldsSchemaId: body.fieldsSchemaId,
        docTemplateIds: Array.isArray(body.docTemplateIds) ? body.docTemplateIds : [],
        isSystem: !!body.isSystem,
        createdAt: new Date().toISOString(),
      };
      memStore.items.push(item);
      return res.json({ ok: true, item: memLean(item) });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }
  if (!OrderType) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const body = req.body || {};
    const { code, name } = body;
    if (!code || !name) return res.status(400).json({ error: 'VALIDATION_ERROR' });
    body.code = String(code).trim().toLowerCase();

    const created = await OrderType.create(body);
    let q = OrderType.findById(created._id);
    for (const p of buildPopulate()) q = q.populate(p);
    const item = await q.lean();
    return res.json({ ok: true, item });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    if (err && err.name === 'ValidationError') {
      if ((err.message || '').includes('ORDERTYPE_INVALID_START_STATUS')) {
        return res.status(400).json({ error: 'ORDERTYPE_INVALID_START_STATUS' });
      }
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// PATCH /api/order-types/:id — partial update (orderTypes.write)
router.patch('/:id', requirePermission('orderTypes.write'), async (req, res) => {
  if (useMem()) {
    try {
      const { id } = req.params;
      const patch = req.body || {};
      const current = memFindById(id);
      if (!current) return res.status(404).json({ error: 'NOT_FOUND' });
      if (typeof patch.code === 'string') {
        patch.code = normalizeCode(patch.code);
        if (patch.code !== current.code && memFindByCode(patch.code)) {
          return res.status(409).json({ error: 'CODE_EXISTS' });
        }
      }
      const newAllowed = Array.isArray(patch.allowedStatuses) ? patch.allowedStatuses : (current.allowedStatuses || []);
      const newStart = (patch.startStatusId !== undefined) ? patch.startStatusId : current.startStatusId;
      if (newStart) {
        const included = (newAllowed || []).some((v) => String(v) === String(newStart));
        if (!included) return res.status(400).json({ error: 'ORDERTYPE_INVALID_START_STATUS' });
      }
      Object.assign(current, patch);
      return res.json({ ok: true, item: memLean(current) });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }
  if (!OrderType) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const { id } = req.params;
    const patch = req.body || {};
    if (typeof patch.code === 'string') {
      patch.code = patch.code.trim().toLowerCase();
    }

    const current = await OrderType.findById(id).lean();
    if (!current) return res.status(404).json({ error: 'NOT_FOUND' });

    const newAllowed = Array.isArray(patch.allowedStatuses) ? patch.allowedStatuses : (current.allowedStatuses || []);
    const newStart = (patch.startStatusId !== undefined) ? patch.startStatusId : current.startStatusId;
    if (newStart) {
      const included = (newAllowed || []).some((v) => String(v) === String(newStart));
      if (!included) return res.status(400).json({ error: 'ORDERTYPE_INVALID_START_STATUS' });
    }

    let q = OrderType.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
    for (const p of buildPopulate()) q = q.populate(p);
    const item = await q.lean();
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// DELETE /api/order-types/:id — delete (orderTypes.write)
router.delete('/:id', requirePermission('orderTypes.write'), async (req, res) => {
  if (useMem()) {
    try {
      const { id } = req.params;
      const idx = memStore.items.findIndex((i) => String(i._id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
      const item = memStore.items[idx];
      if (item.isSystem) return res.status(409).json({ error: 'SYSTEM_TYPE' });
      // No usage guard in DEV mem branch
      memStore.items.splice(idx, 1);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }
  if (!OrderType) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const { id } = req.params;
    const item = await OrderType.findById(id).lean();
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    if (item.isSystem) return res.status(409).json({ error: 'SYSTEM_TYPE' });

    let usedByOrders = null;
    try {
      const code = item.code;
      const oid = item._id;
      usedByOrders = await Order.exists({
        $or: [
          { type: code }, { types: code }, { 'meta.orderType': code },
          { type: oid }, { types: oid }, { orderTypeId: oid }, { 'meta.orderTypeId': oid },
        ],
      });
    } catch (e) {
      console.warn('[orderTypes.delete] Order.exists check failed:', e && e.message ? e.message : e);
    }
    if (usedByOrders) return res.status(409).json({ error: 'ORDERTYPE_IN_USE' });

    await OrderType.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;