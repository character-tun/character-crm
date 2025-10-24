const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');

let Order; try { Order = require('../models/Order'); } catch (e) {}
let Payment; try { Payment = require('../server/models/Payment'); } catch (e) {}
let CashRegister; try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}


const { requirePermission, hasPermission, requireRole } = require('../middleware/auth');
const { isPaymentsLocked, getDevState } = require('../services/statusActionsHandler');
const OrderStatusLog = require('../models/OrderStatusLog');



const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

async function recordAudit(orderId, userId, note) {
  try {
    if (!mongoReady()) return;
    const payload = {
      orderId: new mongoose.Types.ObjectId(String(orderId)),
      from: 'payments',
      to: 'payments',
      userId: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
      note,
    };
    await OrderStatusLog.create(payload);
  } catch (e) {
    console.warn('[payments] AuditLog failed:', e && e.message ? e.message : e);
  }
}

// DEV mode helpers
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
let devStore; try { devStore = require('../services/devPaymentsStore'); } catch (_) {}

// Validation schemas
/* Validation schemas moved to middleware/validate.js */

function buildMatch(query) {
  const q = query || {};
  const match = {};
  // type filter
  if (q.type && ['income', 'expense', 'refund'].includes(q.type)) match.type = q.type;
  // ids
  ['orderId', 'cashRegisterId', 'locationId'].forEach((k) => {
    if (q[k]) {
      try {
        match[k] = new mongoose.Types.ObjectId(String(q[k]));
      } catch (_) { /* ignore invalid */ }
    }
  });
  // date range
  if (q.dateFrom || q.dateTo) {
    match.createdAt = {};
    if (q.dateFrom) {
      const df = new Date(String(q.dateFrom));
      if (!isNaN(df)) match.createdAt.$gte = df;
    }
    if (q.dateTo) {
      const dt = new Date(String(q.dateTo));
      if (!isNaN(dt)) match.createdAt.$lte = dt;
    }
  }
  // articlePath: prefix or contains segment
  if (q.articlePath) {
    const s = String(q.articlePath);
    if (s.includes('/')) {
      const segs = s.split('/').map((t) => t.trim()).filter(Boolean);
      segs.forEach((val, idx) => { match[`articlePath.${idx}`] = val; });
    } else {
      match.articlePath = s;
    }
  }
  return match;
}


// GET /api/payments — list with filters and totals (payments.read)
router.get('/', requirePermission('payments.read'), async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    // DEV fallback: aggregate from in-memory store
    if (DEV_MODE && !mongoReady() && devStore && typeof devStore.getItems === 'function') {
      const q = req.query || {};
      const all = devStore.getItems() || [];
      const filtered = all.filter((i) => {
        if (q.type && i.type !== q.type) return false;
        if (q.orderId && String(i.orderId) !== String(q.orderId)) return false;
        if (q.cashRegisterId && String(i.cashRegisterId) !== String(q.cashRegisterId)) return false;
        if (q.locationId && String(i.locationId) !== String(q.locationId)) return false;
        if (q.dateFrom) {
          const df = new Date(String(q.dateFrom));
          if (!isNaN(df) && new Date(i.createdAt || 0) < df) return false;
        }
        if (q.dateTo) {
          const dt = new Date(String(q.dateTo));
          if (!isNaN(dt) && new Date(i.createdAt || 0) > dt) return false;
        }
        if (q.articlePath) {
          const s = String(q.articlePath);
          if (s.includes('/')) {
            const segs = s.split('/').map((t) => t.trim()).filter(Boolean);
            const ok = segs.every((val, idx) => String((i.articlePath || [])[idx]) === val);
            if (!ok) return false;
          } else {
            const ok = Array.isArray(i.articlePath) ? i.articlePath.includes(s) : String(i.articlePath) === s;
            if (!ok) return false;
          }
        }
        return true;
      });
      const items = filtered.slice(offset, offset + limit);
      const totals = { income: 0, expense: 0, refund: 0, balance: 0 };
      for (const it of filtered) {
        const amt = Number(it.amount || 0);
        if (it.type === 'income') totals.income += amt;
        if (it.type === 'expense') totals.expense += amt;
        if (it.type === 'refund') totals.refund += amt;
      }
      totals.balance = totals.income - totals.expense - totals.refund;
      return res.json({ ok: true, items, totals });
    }

    if (!Payment) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });

    const match = buildMatch(req.query);
    const items = await Payment.find(match)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const totalsAgg = await Payment.aggregate([
      { $match: match },
      { $group: { _id: '$type', sum: { $sum: '$amount' } } },
    ]);
    const totals = { income: 0, expense: 0, refund: 0, balance: 0 };
    totalsAgg.forEach((g) => {
      if (g._id === 'income') totals.income = g.sum || 0;
      if (g._id === 'expense') totals.expense = g.sum || 0;
      if (g._id === 'refund') totals.refund = g.sum || 0;
    });
    totals.balance = totals.income - totals.expense - totals.refund;

    return res.json({ ok: true, items, totals });
  } catch (err) {
    return next(err);
  }
});

// POST /api/payments — create income|expense (payments.write)
router.post('/', requirePermission('payments.write'), validate(schemas.paymentCreateSchema), async (req, res, next) => {
  try {
    // DEV fallback: minimal validation, no cash register lookup
    if (DEV_MODE && !mongoReady() && devStore) {
      const body = req.body || {};
      const { orderId, type, articlePath, amount, cashRegisterId, method, note, locationId } = body;
      if (!orderId) return next(httpError(400, 'VALIDATION_ERROR'));
      const state = typeof getDevState === 'function' ? (getDevState(String(orderId)) || {}) : {};
      if (state.paymentsLocked === true || (state.closed && state.closed.success === false)) {
        return next(httpError(400, 'PAYMENTS_LOCKED'));
      }
      if (state.closed && state.closed.success === true) {
        return next(httpError(400, 'ORDER_CLOSED'));
      }
      const t = typeof type === 'string' && ['income','expense','refund'].includes(type) ? type : 'income';
      const ap = Array.isArray(articlePath) && articlePath.length > 0
        ? articlePath
        : (t === 'refund' ? ['Возвраты'] : (t === 'expense' ? ['Расходы'] : ['Продажи','Касса']));
      const amt = typeof amount === 'number' ? amount : 0;
      const id = devStore.nextId();
      devStore.pushItem({
        _id: id,
        orderId: String(orderId),
        type: t,
        articlePath: ap,
        amount: amt,
        cashRegisterId: cashRegisterId ? String(cashRegisterId) : (process.env.DEFAULT_CASH_REGISTER ? String(process.env.DEFAULT_CASH_REGISTER) : 'dev-main'),
        method: typeof method === 'string' ? method : 'manual',
        note,
        createdBy: req.user && req.user.id ? String(req.user.id) : undefined,
        locationId: locationId ? String(locationId) : undefined,
        createdAt: new Date().toISOString(),
        locked: false,
      });
      await recordAudit(orderId, req.user && req.user.id, `PAYMENT_CREATE id=${id} type=${t} amount=${amt}`);
      return res.status(200).json({ ok: true, id });
    }

    if (!Payment || !Order || !CashRegister) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const body = req.body || {};
    const { orderId, type, articlePath, amount, cashRegisterId, method, note, locationId } = body;

    const order = await Order.findById(orderId).lean();
    if (!order) return next(httpError(404, 'Order not found'));
    if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
      return next(httpError(400, 'PAYMENTS_LOCKED'));
    }
    if (order.closed && order.closed.success === true) {
      return next(httpError(400, 'ORDER_CLOSED'));
    }

    const t = typeof type === 'string' && ['income','expense','refund'].includes(type) ? type : 'income';
    const ap = Array.isArray(articlePath) && articlePath.length > 0
      ? articlePath
      : (t === 'refund' ? ['Возвраты'] : (t === 'expense' ? ['Расходы'] : ['Продажи','Касса']));
    const amt = typeof amount === 'number' ? amount : 0;
    if (!(amt > 0)) return next(httpError(400, 'VALIDATION_ERROR'));

    // Stub fallback: when Mongo connection not usable, skip DB writes
    if (!mongoReady()) {
      const mockId = new mongoose.Types.ObjectId().toString();
      return res.status(200).json({ ok: true, id: mockId });
    }

    let cashId = cashRegisterId;
    if (cashId) {
      const cash = await CashRegister.findById(cashId).lean();
      if (!cash) return next(httpError(404, 'CASH_NOT_FOUND'));
    } else {
      let cash = null;
      const envDefault = process.env.DEFAULT_CASH_REGISTER;
      if (envDefault) {
        cash = await CashRegister.findById(envDefault).lean().catch(() => null);
        if (!cash) {
          cash = await CashRegister.findOne({ code: envDefault }).lean().catch(() => null);
        }
      }
      if (!cash) {
        cash = await CashRegister.findOne({ defaultForLocation: true }).lean().catch(() => null);
      }
      if (!cash) {
        cash = await CashRegister.findOne({ isSystem: true, code: 'main' }).lean().catch(() => null);
      }
      if (!cash) { cash = await CashRegister.findOne({}).lean().catch(() => null); }
      if (!cash || !cash._id) return next(httpError(404, 'CASH_NOT_FOUND'));
      cashId = cash._id;
    }

    const payload = {
      orderId: new mongoose.Types.ObjectId(orderId),
      type: t,
      articlePath: ap,
      amount: amt,
      cashRegisterId: new mongoose.Types.ObjectId(cashId),
      method: typeof method === 'string' ? method : 'manual',
      note,
      createdBy: req.user && req.user.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
      locationId: locationId ? new mongoose.Types.ObjectId(locationId) : (order.locationId ? new mongoose.Types.ObjectId(order.locationId) : undefined),
    };
    const created = await Payment.create(payload);
    await recordAudit(orderId, req.user && req.user.id, `PAYMENT_CREATE id=${created._id} type=${t} amount=${amt}`);
    return res.status(200).json({ ok: true, id: created._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// POST /api/payments/refund — create refund (payments.write)
router.post('/refund', requirePermission('payments.write'), validate(schemas.paymentRefundSchema), async (req, res, next) => {
  try {
    const refundsEnabled = String(process.env.PAYMENTS_REFUND_ENABLED || '1') === '1';
    if (!refundsEnabled) return next(httpError(403, 'REFUND_DISABLED'));
    // DEV fallback: minimal validation, no cash register lookup
    if (DEV_MODE && !mongoReady() && devStore) {
      const body = req.body || {};
      const { orderId, articlePath, amount, cashRegisterId, method, note, locationId } = body;
      if (!orderId) return next(httpError(400, 'VALIDATION_ERROR'));
      const state = typeof getDevState === 'function' ? (getDevState(String(orderId)) || {}) : {};
      if (state.paymentsLocked === true || (state.closed && state.closed.success === false)) {
        return next(httpError(400, 'PAYMENTS_LOCKED'));
      }
      if (state.closed && state.closed.success === true) {
        return next(httpError(400, 'ORDER_CLOSED'));
      }
      const ap = Array.isArray(articlePath) && articlePath.length > 0 ? articlePath : ['Возвраты'];
      const amt = typeof amount === 'number' ? amount : 0;
      const id = devStore.nextId();
      devStore.pushItem({
        _id: id,
        orderId: String(orderId),
        type: 'refund',
        articlePath: ap,
        amount: amt,
        cashRegisterId: cashRegisterId ? String(cashRegisterId) : (process.env.DEFAULT_CASH_REGISTER ? String(process.env.DEFAULT_CASH_REGISTER) : 'dev-main'),
        method: typeof method === 'string' ? method : 'manual',
        note,
        createdBy: req.user && req.user.id ? String(req.user.id) : undefined,
        locationId: locationId ? String(locationId) : undefined,
        createdAt: new Date().toISOString(),
        locked: false,
      });
      await recordAudit(orderId, req.user && req.user.id, `PAYMENT_REFUND id=${id} amount=${amt}`);
      return res.status(200).json({ ok: true, id });
    }

    if (!Payment || !Order || !CashRegister) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const body = req.body || {};
    const { orderId, articlePath, amount, cashRegisterId, method, note, locationId } = body;

    const order = await Order.findById(orderId).lean();
    if (!order) return next(httpError(404, 'Order not found'));
    if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
      return next(httpError(400, 'PAYMENTS_LOCKED'));
    }
    if (order.closed && order.closed.success === true) {
      return next(httpError(400, 'ORDER_CLOSED'));
    }

    const ap = Array.isArray(articlePath) && articlePath.length > 0 ? articlePath : ['Возвраты'];
    const amt = typeof amount === 'number' ? amount : 0;
    if (!(amt > 0)) return next(httpError(400, 'VALIDATION_ERROR'));

    // Stub fallback: when Mongo connection not usable, skip DB writes
    if (!mongoReady()) {
      const mockId = new mongoose.Types.ObjectId().toString();
      return res.status(200).json({ ok: true, id: mockId });
    }

    let cashId = cashRegisterId;
    if (cashId) {
      const cash = await CashRegister.findById(cashId).lean();
      if (!cash) return next(httpError(404, 'CASH_NOT_FOUND'));
    } else {
      let cash = null;
      const envDefault = process.env.DEFAULT_CASH_REGISTER;
      if (envDefault) {
        cash = await CashRegister.findById(envDefault).lean().catch(() => null);
        if (!cash) {
          cash = await CashRegister.findOne({ code: envDefault }).lean().catch(() => null);
        }
      }
      if (!cash) {
        cash = await CashRegister.findOne({ defaultForLocation: true }).lean().catch(() => null);
      }
      if (!cash) { cash = await CashRegister.findOne({ isSystem: true, code: 'main' }).lean().catch(() => null); }
      if (!cash) { cash = await CashRegister.findOne({}).lean().catch(() => null); }
      if (!cash || !cash._id) return next(httpError(404, 'CASH_NOT_FOUND'));
      cashId = cash._id;
    }

    const payload = {
      orderId: new mongoose.Types.ObjectId(orderId),
      type: 'refund',
      articlePath: ap,
      amount: amt,
      cashRegisterId: new mongoose.Types.ObjectId(cashId),
      method: typeof method === 'string' ? method : 'manual',
      note,
      createdBy: req.user && req.user.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
      locationId: locationId ? new mongoose.Types.ObjectId(locationId) : (order.locationId ? new mongoose.Types.ObjectId(order.locationId) : undefined),
    };
    const created = await Payment.create(payload);
    await recordAudit(orderId, req.user && req.user.id, `PAYMENT_REFUND id=${created._id} amount=${amt}`);
    return res.status(200).json({ ok: true, id: created._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// PATCH /api/payments/:id — edit payment (payments.write), forbid if locked unless payments.lock override
router.patch('/:id', requirePermission('payments.write'), validate(schemas.paymentPatchSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    const strict = String(process.env.CASH_LOCK_STRICT || '0') === '1';

    // DEV fallback: update in-memory item
    if (DEV_MODE && !mongoReady() && devStore) {
      const items = devStore.getItems();
      const idx = items.findIndex((i) => String(i._id) === String(id));
      if (idx === -1) return next(httpError(404, 'NOT_FOUND'));
      const current = items[idx];
      const strict = String(process.env.CASH_LOCK_STRICT || '0') === '1';
      if (current.locked && (strict || !hasPermission(req, 'payments.lock'))) return next(httpError(403, 'PAYMENT_LOCKED'));
      if (typeof patch.type === 'string') return next(httpError(400, 'VALIDATION_ERROR'));
      if (typeof patch.locked !== 'undefined' || typeof patch.lockedAt !== 'undefined') return next(httpError(400, 'VALIDATION_ERROR'));
      items[idx] = { ...current, ...patch };
      await recordAudit(current.orderId, req.user && req.user.id, `PAYMENT_UPDATE id=${id} fields=${Object.keys(patch).join(',')}`);
      return res.json({ ok: true, item: items[idx] });
    }

    if (!Payment || !Order || !CashRegister) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));

    const current = await Payment.findById(id).lean();
    if (!current) return next(httpError(404, 'NOT_FOUND'));

    if (current.locked && (strict || !hasPermission(req, 'payments.lock'))) return next(httpError(403, 'PAYMENT_LOCKED'));

    if (current.orderId) {
      const order = await Order.findById(current.orderId).lean();
      if (!order) return next(httpError(404, 'Order not found'));
      if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
        return next(httpError(403, 'PAYMENTS_LOCKED'));
      }
      if (order.closed && order.closed.success === true) {
        return next(httpError(403, 'ORDER_CLOSED'));
      }
    }

    if (typeof patch.type === 'string') {
      return next(httpError(400, 'VALIDATION_ERROR'));
    }

    if (typeof patch.locked !== 'undefined' || typeof patch.lockedAt !== 'undefined') {
      return next(httpError(400, 'VALIDATION_ERROR'));
    }

    if (patch.cashRegisterId) {
      const cash = await CashRegister.findById(patch.cashRegisterId).lean();
      if (!cash) return next(httpError(404, 'CASH_NOT_FOUND'));
    }

    const item = await Payment.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return next(httpError(404, 'NOT_FOUND'));
    await recordAudit(item.orderId, req.user && req.user.id, `PAYMENT_UPDATE id=${id} fields=${Object.keys(patch).join(',')}`);
    return res.json({ ok: true, item });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// POST /api/payments/:id/lock — set locked=true (payments.lock)
router.post('/:id/lock', requirePermission('payments.lock'), async (req, res, next) => {
  try {
    const id = String(req.params.id);

    // DEV fallback: set lock on in-memory item
    if (DEV_MODE && !mongoReady() && devStore) {
      const items = devStore.getItems();
      const item = items.find((i) => String(i._id) === String(id));
      if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
      if (!item.locked) {
        item.locked = true;
        item.lockedAt = new Date().toISOString();
      }
      await recordAudit(item.orderId, req.user && req.user.id, `PAYMENT_LOCK id=${id}`);
      return res.json({ ok: true, item });
    }

    if (!Payment) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: 'NOT_FOUND' });
    if (payment.locked) {
      await recordAudit(payment.orderId, req.user && req.user.id, `PAYMENT_LOCK id=${id}`);
      return res.json({ ok: true, item: payment });
    }
    payment.locked = true;
    payment.lockedAt = new Date();
    await payment.save();
    await recordAudit(payment.orderId, req.user && req.user.id, `PAYMENT_LOCK id=${id}`);
    return res.json({ ok: true, item: payment });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/payments/:id — Admin only, forbid if locked
router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // DEV fallback: remove from in-memory store
    if (DEV_MODE && !mongoReady() && devStore && typeof devStore.getItems === 'function') {
      const items = devStore.getItems();
      const idx = items.findIndex((i) => String(i._id) === String(id));
      if (idx === -1) return next(httpError(404, 'NOT_FOUND'));
      const current = items[idx];
      if (current.locked === true) return next(httpError(403, 'PAYMENT_LOCKED'));
      items.splice(idx, 1);
      return res.json({ ok: true });
    }

    if (!Payment) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));
    const current = await Payment.findById(id).lean();
    if (!current) return next(httpError(404, 'NOT_FOUND'));
    if (current.locked === true) return next(httpError(403, 'PAYMENT_LOCKED'));

    await Payment.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;