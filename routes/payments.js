const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');

let Order; try { Order = require('../models/Order'); } catch (e) {}
let Payment; try { Payment = require('../server/models/Payment'); } catch (e) {}
let CashRegister; try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}


const { requirePermission, hasPermission } = require('../middleware/auth');



const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// DEV payments store


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

    let cashId = cashRegisterId;
    if (cashId) {
      const cash = await CashRegister.findById(cashId).lean();
      if (!cash) return next(httpError(404, 'CASH_NOT_FOUND'));
    } else {
      let cash = await CashRegister.findOne({ defaultForLocation: true }).lean().catch(() => null);
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
    return res.status(200).json({ ok: true, id: created._id });
  } catch (err) {
    if (err && err.name === 'ValidationError') return next(httpError(400, 'VALIDATION_ERROR'));
    return next(err);
  }
});

// POST /api/payments/refund — create refund (payments.write)
router.post('/refund', requirePermission('payments.write'), validate(schemas.paymentRefundSchema), async (req, res, next) => {
  try {
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

    let cashId = cashRegisterId;
    if (cashId) {
      const cash = await CashRegister.findById(cashId).lean();
      if (!cash) return next(httpError(404, 'CASH_NOT_FOUND'));
    } else {
      let cash = await CashRegister.findOne({ defaultForLocation: true }).lean().catch(() => null);
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

    if (!Payment || !Order || !CashRegister) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));

    const current = await Payment.findById(id).lean();
    if (!current) return next(httpError(404, 'NOT_FOUND'));

    if (current.locked && !hasPermission(req, 'payments.lock')) return next(httpError(403, 'PAYMENT_LOCKED'));

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
    if (!Payment) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: 'NOT_FOUND' });
    if (payment.locked) return res.json({ ok: true, item: payment });
    payment.locked = true;
    payment.lockedAt = new Date();
    await payment.save();
    return res.json({ ok: true, item: payment });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;