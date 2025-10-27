const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');
const { requireStocksEnabled } = require('../middleware/featureFlags/stock');

// Feature-flag: guard stock routes unless ENABLE_STOCKS is enabled
router.use(requireStocksEnabled);

let StockItem; try { StockItem = require('../server/models/StockItem'); } catch (e) {}
let StockMovement; try { StockMovement = require('../server/models/StockMovement'); } catch (e) {}
let StockLedger; try { StockLedger = require('../server/models/StockLedger'); } catch (e) {}
let StockBalance; try { StockBalance = require('../server/models/StockBalance'); } catch (e) {}
let Item; try { Item = require('../server/models/Item'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const httpError = (statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; };

// DEV in-memory store
const devStockItems = []; // { _id, itemId, qtyOnHand, unit, minQty, maxQty, createdBy, createdAt, updatedAt }
const devStockMovements = []; // { _id, itemId, type, qty, note, source, createdBy, createdAt }
const devLedger = []; // { _id, itemId, locationId, qty, cost, refType, refId, ts, createdBy }
const devBalance = []; // { _id, itemId, locationId, qty, adjustment, ts, createdBy }
let seqSI = 1; const nextSI = () => `si-${seqSI++}`;
let seqSM = 1; const nextSM = () => `sm-${seqSM++}`;
let seqSL = 1; const nextSL = () => `sl-${seqSL++}`;
let seqSB = 1; const nextSB = () => `sb-${seqSB++}`;

function listDevItems(q) {
  const s = String(q || '').trim().toLowerCase();
  const arr = devStockItems.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!s) return arr;
  return arr.filter((it) => String(it.itemId || '').toLowerCase().includes(s));
}

function currentQtyDev(itemId, locationId) {
  const sum = devLedger
    .filter((l) => String(l.itemId) === String(itemId) && String(l.locationId || '') === String(locationId || ''))
    .reduce((acc, l) => acc + Number(l.qty || 0), 0);
  return sum;
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
    const items = await StockItem.find(match).sort({ updatedAt: -1 }).skip(offset).limit(limit)
      .lean();
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
    const items = devStockMovements.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(offset, offset + limit);
    return res.json({ ok: true, items });
  }

  if (!StockMovement) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await StockMovement.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit)
      .lean();
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
    const locationId = String(body.locationId || '').trim() || undefined;
    const cost = typeof body.cost === 'number' ? body.cost : undefined;
    const ts = body.ts ? new Date(body.ts) : new Date();

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
      // Also record to ledger
      const led = { _id: nextSL(), itemId, locationId, qty: signed, cost, refType: 'movement', op: type, refId: mv._id, ts, createdBy: req.user && req.user.id };
      devLedger.push(led);
      return res.status(201).json({ ok: true, item: mv, ledgerId: led._id });
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
    // Also record to ledger (only if ids are valid ObjectId)
    if (StockLedger) {
      const itemIdObj = mongoose.Types.ObjectId.isValid(itemId) ? mongoose.Types.ObjectId(itemId) : null;
      const locationIdObj = locationId && mongoose.Types.ObjectId.isValid(locationId) ? mongoose.Types.ObjectId(locationId) : undefined;
      if (itemIdObj) {
        await StockLedger.create({ itemId: itemIdObj, locationId: locationIdObj, qty: signed, cost, refType: 'movement', op: type, refId: mv._id, ts, createdBy: req.user && req.user.id });
      }
    }
    return res.status(201).json({ ok: true, item: mv });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// POST /api/stock/transfer — move stock between locations
router.post('/transfer', requirePermission('warehouse.write'), validate(schemas.stockTransferSchema), async (req, res, next) => {
  try {
    const body = req.body || {};
    const itemId = String(body.itemId || '').trim();
    const fromLocationId = String(body.fromLocationId || '').trim();
    const toLocationId = String(body.toLocationId || '').trim();
    const qty = Number(body.qty || 0);
    const cost = typeof body.cost === 'number' ? body.cost : undefined;
    const ts = body.ts ? new Date(body.ts) : new Date();
    const refId = new mongoose.Types.ObjectId();

    if (qty <= 0) return next(httpError(400, 'QTY_MUST_BE_POSITIVE'));

    if (DEV_MODE && !mongoReady()) {
      const out = { _id: nextSL(), itemId, locationId: fromLocationId, qty: -Math.abs(qty), cost, refType: 'transfer', op: 'transfer_out', refId, ts, createdBy: req.user && req.user.id };
      const inc = { _id: nextSL(), itemId, locationId: toLocationId, qty: Math.abs(qty), cost, refType: 'transfer', op: 'transfer_in', refId, ts, createdBy: req.user && req.user.id };
      devLedger.push(out, inc);
      return res.status(201).json({ ok: true, items: [out, inc] });
    }

    if (!StockLedger) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const out = await StockLedger.create({ itemId: mongoose.Types.ObjectId(itemId), locationId: mongoose.Types.ObjectId(fromLocationId), qty: -Math.abs(qty), cost, refType: 'transfer', op: 'transfer_out', refId, ts, createdBy: req.user && req.user.id });
    const inc = await StockLedger.create({ itemId: mongoose.Types.ObjectId(itemId), locationId: mongoose.Types.ObjectId(toLocationId), qty: Math.abs(qty), cost, refType: 'transfer', op: 'transfer_in', refId, ts, createdBy: req.user && req.user.id });
    return res.status(201).json({ ok: true, items: [out, inc] });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// POST /api/stock/inventory — snapshot and ledger adjust
router.post('/inventory', requirePermission('warehouse.write'), validate(schemas.stockInventorySchema), async (req, res, next) => {
  try {
    const body = req.body || {};
    const itemId = String(body.itemId || '').trim();
    const locationId = String(body.locationId || '').trim();
    const countedQty = Number(body.qty || 0);
    const cost = typeof body.cost === 'number' ? body.cost : undefined;
    const ts = body.ts ? new Date(body.ts) : new Date();

    if (DEV_MODE && !mongoReady()) {
      const current = currentQtyDev(itemId, locationId);
      const diff = countedQty - current;
      const led = { _id: nextSL(), itemId, locationId, qty: diff, cost, refType: 'inventory', op: 'inventory', refId: `inv-${Date.now()}`, ts, createdBy: req.user && req.user.id };
      devLedger.push(led);
      const bal = { _id: nextSB(), itemId, locationId, qty: countedQty, adjustment: true, ts, createdBy: req.user && req.user.id };
      devBalance.push(bal);
      return res.status(201).json({ ok: true, ledgerId: led._id, balanceId: bal._id });
    }

    if (!StockLedger || !StockBalance) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const match = { itemId: mongoose.Types.ObjectId(itemId) };
    if (locationId) match.locationId = mongoose.Types.ObjectId(locationId);
    const agg = await StockLedger.aggregate([
      { $match: match },
      { $group: { _id: null, qty: { $sum: '$qty' } } },
    ]);
    const current = agg && agg[0] ? agg[0].qty : 0;
    const diff = countedQty - current;
    const led = await StockLedger.create({ itemId: mongoose.Types.ObjectId(itemId), locationId: locationId ? mongoose.Types.ObjectId(locationId) : undefined, qty: diff, cost, refType: 'inventory', op: 'inventory', refId: new mongoose.Types.ObjectId(), ts, createdBy: req.user && req.user.id });
    const bal = await StockBalance.create({ itemId: mongoose.Types.ObjectId(itemId), locationId: locationId ? mongoose.Types.ObjectId(locationId) : undefined, qty: countedQty, adjustment: true, ts, createdBy: req.user && req.user.id });
    return res.status(201).json({ ok: true, ledgerId: led._id, balanceId: bal._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// GET /api/stock/ledger
router.get('/ledger', requirePermission('warehouse.read'), async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const itemId = req.query.itemId ? String(req.query.itemId).trim() : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId).trim() : undefined;
    const refType = req.query.refType ? String(req.query.refType).trim() : undefined;

    if (DEV_MODE && !mongoReady()) {
      let arr = devLedger.slice();
      if (itemId) arr = arr.filter((l) => String(l.itemId) === itemId);
      if (locationId) arr = arr.filter((l) => String(l.locationId || '') === locationId);
      if (refType) arr = arr.filter((l) => String(l.refType || '') === refType);
      arr = arr.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(offset, offset + limit);
      return res.json({ ok: true, items: arr });
    }

    if (!StockLedger) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const match = {};
    if (itemId) match.itemId = mongoose.Types.ObjectId(itemId);
    if (locationId) match.locationId = mongoose.Types.ObjectId(locationId);
    if (refType) match.refType = refType;
    const items = await StockLedger.find(match).sort({ ts: -1 }).skip(offset).limit(limit)
      .lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/stock/balance
router.get('/balance', requirePermission('warehouse.read'), async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const itemId = req.query.itemId ? String(req.query.itemId).trim() : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId).trim() : undefined;

    if (DEV_MODE && !mongoReady()) {
      const map = new Map();
      for (const l of devLedger) {
        if (itemId && String(l.itemId) !== itemId) continue;
        if (locationId && String(l.locationId || '') !== locationId) continue;
        const key = `${l.itemId}|${l.locationId || ''}`;
        map.set(key, (map.get(key) || 0) + Number(l.qty || 0));
      }
      const all = Array.from(map.entries()).map(([key, qty]) => {
        const [it, loc] = key.split('|');
        return { itemId: it, locationId: loc || undefined, qty };
      }).sort((a, b) => b.qty - a.qty);
      const items = all.slice(offset, offset + limit);
      return res.json({ ok: true, items });
    }

    if (!StockLedger) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const match = {};
    if (itemId) match.itemId = mongoose.Types.ObjectId(itemId);
    if (locationId) match.locationId = mongoose.Types.ObjectId(locationId);
    const agg = await StockLedger.aggregate([
      { $match: match },
      { $group: { _id: { itemId: '$itemId', locationId: '$locationId' }, qty: { $sum: '$qty' } } },
      { $sort: { qty: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);
    const items = agg.map((a) => ({ itemId: a._id.itemId, locationId: a._id.locationId, qty: a.qty }));
    return res.json({ ok: true, items });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;