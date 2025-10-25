const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const { requireRoles, requirePermission } = require('../middleware/auth');

let ShopSale; try { ShopSale = require('../server/models/ShopSale'); } catch (e) {}
let Payment; try { Payment = require('../server/models/Payment'); } catch (e) {}
let CashRegister; try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}
let StockLedger; try { StockLedger = require('../server/models/StockLedger'); } catch (e) {}
let telegramNotify; try { telegramNotify = require('../services/telegramNotify'); } catch (_) {}

// DEV helpers
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
let devPaymentsStore; try { devPaymentsStore = require('../services/devPaymentsStore'); } catch (_) {}

// DEV in-memory store for sales
const devSales = [];
let devSeq = 1;
const nextId = () => `sale-${devSeq++}`;

function calcTotals(items) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = list.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0);
  const discountTotal = 0;
  const grandTotal = subtotal - discountTotal;
  return { subtotal, discountTotal, grandTotal };
}

// GET /api/shop/sales — list sales (Admin/Manager)
router.get('/sales', requireRoles('Admin', 'Manager'), async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = devSales.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(offset, offset+limit);
    return res.json({ ok: true, items });
  }

  if (!ShopSale) return res.status(503).json({ error: 'NOT_AVAILABLE' });
  try {
    const items = await ShopSale.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/shop/sales — create a sale (Admin/Manager)
router.post('/sales', requireRoles('Admin', 'Manager'), validate(schemas.shopSaleCreateSchema), async (req, res, next) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items.map((x) => ({
      itemId: x.itemId ? String(x.itemId) : undefined,
      name: String(x.name || '').trim(),
      sku: x.sku ? String(x.sku) : undefined,
      unit: x.unit ? String(x.unit) : undefined,
      price: Number(x.price || 0),
      qty: Number(x.qty || 1),
    })) : [];
    const { subtotal, discountTotal, grandTotal } = calcTotals(items);

    const locationId = body.locationId ? String(body.locationId) : undefined;
    const method = body.method ? String(body.method) : 'cash';
    const cashRegisterId = body.cashRegisterId ? String(body.cashRegisterId) : (process.env.DEFAULT_CASH_REGISTER ? String(process.env.DEFAULT_CASH_REGISTER) : 'dev-main');
    const note = body.note ? String(body.note) : undefined;

    // DEV branch: store sale + create dev payment + optional ledger entries
    if (DEV_MODE && !mongoReady()) {
      const id = nextId();
      const sale = {
        _id: id,
        items,
        totals: { subtotal, discountTotal, grandTotal },
        locationId,
        method,
        cashRegisterId,
        note,
        createdAt: new Date().toISOString(),
        createdBy: req.user && req.user.id ? String(req.user.id) : undefined,
        refunds: [],
      };
      devSales.push(sale);

      if (devPaymentsStore) {
        const payId = devPaymentsStore.nextId();
        devPaymentsStore.pushItem({
          _id: payId,
          orderId: id, // use sale id for linking in DEV lists
          type: 'income',
          articlePath: ['Магазин', 'Продажи'],
          amount: grandTotal,
          cashRegisterId,
          method,
          note,
          createdBy: sale.createdBy,
          locationId,
          createdAt: new Date().toISOString(),
          locked: false,
        });
        sale.paymentId = payId;
      }

      // Optional DEV ledger mirror (not shared with /api/stock)
      // Intentionally not implemented to avoid duplication with stock route DEV store

      if (telegramNotify && typeof telegramNotify.sendSaleAlert === 'function') {
        telegramNotify.sendSaleAlert(sale).catch((e) => console.warn('[shop.telegram] send fail', e.message));
      }

      return res.status(201).json({ ok: true, id });
    }

    // Mongo branch (initial): persist sale only; creating Payment without Order is TBD
    if (!ShopSale) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
    const created = await ShopSale.create({
      items,
      totals: { subtotal, discountTotal, grandTotal },
      locationId,
      method,
      cashRegisterId,
      note,
      createdBy: req.user && req.user.id ? new mongoose.Types.ObjectId(String(req.user.id)) : undefined,
    });
    const saleObj = created && created.toObject ? created.toObject() : created;
    saleObj._id = String(created && created._id);
    if (telegramNotify && typeof telegramNotify.sendSaleAlert === 'function') {
      try { await telegramNotify.sendSaleAlert(saleObj); } catch (e) { console.warn('[shop.telegram] send fail', e.message); }
    }
    return res.status(201).json({ ok: true, id: created._id });
  } catch (err) {
    return next(err);
  }
});

// POST /api/shop/sales/:id/refund — refund a sale (Admin/Manager)
router.post('/sales/:id/refund', requireRoles('Admin', 'Manager'), validate(schemas.shopSaleRefundSchema), async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const amount = Number(req.body && req.body.amount || 0);
    const reason = req.body && req.body.reason ? String(req.body.reason) : undefined;

    if (DEV_MODE && !mongoReady()) {
      const sale = devSales.find((s) => String(s._id) === id);
      if (!sale) return res.status(404).json({ error: 'NOT_FOUND' });
      const refundAmt = amount > 0 ? amount : (sale.totals && sale.totals.grandTotal) || 0;
      const refund = { amount: refundAmt, reason, ts: new Date().toISOString(), by: req.user && req.user.id ? String(req.user.id) : undefined };
      sale.refunds = Array.isArray(sale.refunds) ? sale.refunds.concat([refund]) : [refund];

      if (devPaymentsStore) {
        const payId = devPaymentsStore.nextId();
        devPaymentsStore.pushItem({
          _id: payId,
          orderId: id,
          type: 'refund',
          articlePath: ['Возвраты'],
          amount: refundAmt,
          cashRegisterId: sale.cashRegisterId || (process.env.DEFAULT_CASH_REGISTER ? String(process.env.DEFAULT_CASH_REGISTER) : 'dev-main'),
          method: sale.method || 'cash',
          note: reason,
          createdBy: req.user && req.user.id ? String(req.user.id) : undefined,
          locationId: sale.locationId,
          createdAt: new Date().toISOString(),
          locked: false,
        });
      }

      // Optional: DEV ledger reverse entries (not shared with stock route ledger)
      return res.json({ ok: true });
    }

    if (!ShopSale) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
    const sale = await ShopSale.findById(id);
    if (!sale) return res.status(404).json({ error: 'NOT_FOUND' });
    const refundAmt = amount > 0 ? amount : (sale.totals && sale.totals.grandTotal) || 0;
    sale.refunds = Array.isArray(sale.refunds) ? sale.refunds.concat([{ amount: refundAmt, reason, ts: new Date(), by: req.user && req.user.id ? new mongoose.Types.ObjectId(String(req.user.id)) : undefined }]) : [{ amount: refundAmt, reason, ts: new Date(), by: req.user && req.user.id ? new mongoose.Types.ObjectId(String(req.user.id)) : undefined }];
    await sale.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// GET /api/shop/sales/:id — get sale
router.get('/sales/:id', requireRoles('Admin', 'Manager'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (DEV_MODE && !mongoReady()) {
    const sale = devSales.find((s) => String(s._id) === id);
    if (!sale) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item: sale });
  }
  if (!ShopSale) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const sale = await ShopSale.findById(id).lean();
    if (!sale) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item: sale });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;