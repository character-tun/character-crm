const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');

let Item; try { Item = require('../server/models/Item'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// DEV in-memory store
const devItems = [];
let seq = 1;
const nextId = () => `itm-${seq++}`;

function filterDevItems(items, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return items.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return items.filter((it) => String(it.name || '').toLowerCase().includes(s))
    .slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// GET /api/items — list/search (catalog.read)
router.get('/', requirePermission('catalog.read'), async (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const q = req.query.q || req.query.search || '';

  if (DEV_MODE && !mongoReady()) {
    const filtered = filterDevItems(devItems, q);
    const items = filtered.slice(offset, offset + limit);
    return res.json({ ok: true, items });
  }

  if (!Item) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const match = {};
    if (q) match.name = { $regex: String(q), $options: 'i' };
    const items = await Item.find(match).sort({ updatedAt: -1 }).skip(offset).limit(limit)
      .lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/items — create (catalog.write)
router.post('/', requirePermission('catalog.write'), validate(schemas.itemCreateSchema), async (req, res, next) => {
  try {
    const body = req.body || {};

    if (DEV_MODE && !mongoReady()) {
      const item = {
        _id: nextId(),
        name: String(body.name || '').trim(),
        price: Number(body.price || 0),
        unit: String(body.unit || ''),
        uom: String(body.uom || body.unit || ''),
        type: String(body.type || 'good'),
        sku: String(body.sku || ''),
        brand: String(body.brand || ''),
        group: String(body.group || ''),
        attributes: typeof body.attributes === 'object' && body.attributes !== null ? body.attributes : {},
        tags: Array.isArray(body.tags) ? body.tags : [],
        note: String(body.note || ''),
        createdBy: req.user && req.user.id,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      devItems.push(item);
      return res.status(200).json({ ok: true, id: item._id });
    }

    if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    // In prod-like environments, create in DB
    const created = await Item.create({
      name: body.name,
      price: typeof body.price === 'number' ? body.price : 0,
      unit: body.unit,
      uom: body.uom || body.unit,
      type: body.type || 'good',
      sku: body.sku,
      brand: body.brand,
      group: body.group,
      attributes: typeof body.attributes === 'object' && body.attributes !== null ? body.attributes : {},
      tags: Array.isArray(body.tags) ? body.tags : [],
      note: body.note,
      createdBy: req.user && req.user.id,
    });
    return res.status(200).json({ ok: true, id: created._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// PATCH /api/items/:id — update (catalog.write)
router.patch('/:id', requirePermission('catalog.write'), validate(schemas.itemPatchSchema), async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const body = req.body || {};

    if (DEV_MODE && !mongoReady()) {
      const idx = devItems.findIndex((it) => String(it._id) === id);
      if (idx === -1) return next(httpError(404, 'NOT_FOUND'));
      const it = devItems[idx];
      const nextIt = { ...it, ...body, uom: String(body.uom || body.unit || it.uom || it.unit || ''), updatedAt: new Date().toISOString() };
      devItems[idx] = nextIt;
      return res.json({ ok: true, item: nextIt });
    }

    if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const patch = { ...body };
    if (patch.unit && !patch.uom) patch.uom = patch.unit;
    const updated = await Item.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!updated) return next(httpError(404, 'NOT_FOUND'));
    return res.json({ ok: true, item: updated });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

module.exports = router;
