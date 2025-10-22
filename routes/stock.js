const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');

let StockItem; try { StockItem = require('../server/models/StockItem'); } catch (e) {}
let StockMovement; try { StockMovement = require('../server/models/StockMovement'); } catch (e) {}
let Item; try { Item = require('../server/models/Item'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const httpError = (statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; };

// DEV in-memory store
const devStockItems = []; // { _id, itemId, qtyOnHand, unit, minQty, maxQty, createdBy, createdAt, updatedAt }
const devStockMovements = []; // { _id, itemId, type, qty, note, source, createdBy, createdAt }
let seqSI = 1; const nextSI = () => `si-${seqSI++}`;
let seqSM = 1; const nextSM = () => `sm-${seqSM++}`;

function listDevItems(q) {
  const s = String(q || '').trim().toLowerCase();
  const arr = devStockItems.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  if (!s) return arr;
  return arr.filter(it => String(it.itemId || '').toLowerCase().includes(s));
}

// GET /api/stock/items
router.get('/items', requirePermission('warehouse.read'), async (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const q = req.query.q || '';

  if (DEV_MODE && !mongoReady()) {
    const items = listDevItems(q).slice(offset, offset + limit);
    return res.json({ ok: true, items });
  }

  if (!StockItem) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const match = {};
    // q can search by itemId as string (basic)
    const items = await StockItem.find(match).sort({ updatedAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/stock/items — optionally create stock item record
router.post('/items', requirePermission('warehouse.write'), validate(schemas.stockItemCreateSchema), async (req, res, next) => {
  try {
    const body = req.body || {};
    const itemId = String(body.itemId || '').trim();

    if (DEV_MODE && !mongoReady()) {
      const existing = devStockItems.find((it) => String(it.itemId) === itemId);
      if (existing) return res.json({ ok: true, id: existing._id });
      const it = {
        _id: nextSI(), itemId, qtyOnHand: Number(body.qtyOnHand || 0), unit: String(body.unit || ''),
        minQty: Number(body.minQty || 0), maxQty: Number(body.maxQty || 0),
        createdBy: req.user && req.user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      devStockItems.push(it);
      return res.json({ ok: true, id: it._id });
    }

    if (!StockItem) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const created = await StockItem.create({
      itemId,
      qtyOnHand: typeof body.qtyOnHand === 'number' ? body.qtyOnHand : 0,
      unit: body.unit,
      minQty: typeof body.minQty === 'number' ? body.minQty : 0,
      maxQty: typeof body.maxQty === 'number' ? body.maxQty : 0,
      createdBy: req.user && req.user.id,
    });
    return res.json({ ok: true, id: created._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// GET /api/stock/movements
router.get('/movements', requirePermission('warehouse.read'), async (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = devStockMovements.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(offset, offset + limit);
    return res.json({ ok: true, items });
  }

  if (!StockMovement) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await StockMovement.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/stock/movements — create receipt/issue/adjust
router.post('/movements', requirePermission('warehouse.write'), validate(schemas.stockMovementCreateSchema), async (req, res, next) => {
  try {
    const body = req.body || {};
    const itemId = String(body.itemId || '').trim();
    const type = String(body.type || '').trim();
    const qty = Number(body.qty || 0);
    const note = String(body.note || '');

    // Normalize sign: receipt => +qty, issue => -qty
    const signed = type === 'receipt' ? qty : (type === 'issue' ? -Math.abs(qty) : qty);

    if (DEV_MODE && !mongoReady()) {
      let si = devStockItems.find((it) => String(it.itemId) === itemId);
      if (!si) {
        si = { _id: nextSI(), itemId, qtyOnHand: 0, unit: '', minQty: 0, maxQty: 0, createdBy: req.user && req.user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        devStockItems.push(si);
      }
      si.qtyOnHand = Number(si.qtyOnHand || 0) + signed;
      si.updatedAt = new Date().toISOString();
      const mv = { _id: nextSM(), itemId, type, qty: signed, note, source: body.source || { kind: 'manual' }, createdBy: req.user && req.user.id, createdAt: new Date().toISOString() };
      devStockMovements.push(mv);
      return res.status(201).json({ ok: true, item: mv });
    }

    if (!StockItem || !StockMovement) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    let si = await StockItem.findOne({ itemId });
    if (!si) {
      si = await StockItem.create({ itemId, qtyOnHand: 0, createdBy: req.user && req.user.id });
    }
    // Adjust qty atomically
    si.qtyOnHand = Number(si.qtyOnHand || 0) + signed;
    await si.save();
    const mv = await StockMovement.create({
      stockItemId: si._id,
      itemId,
      type,
      qty: signed,
      note,
      source: body.source || { kind: 'manual' },
      createdBy: req.user && req.user.id,
    });
    return res.status(201).json({ ok: true, item: mv });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

module.exports = router;