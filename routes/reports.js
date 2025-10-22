const express = require('express');
const mongoose = require('mongoose');
const { requirePermission } = require('../middleware/auth');

let Payment; try { Payment = require('../server/models/Payment'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const router = express.Router();

function parseDate(val) {
  const d = val ? new Date(String(val)) : null;
  return d && !isNaN(d) ? d : null;
}

function filterDev(items, { dateFrom, dateTo, locationId }) {
  const df = parseDate(dateFrom);
  const dt = parseDate(dateTo);
  return items.filter((it) => {
    if (df && !(new Date(it.createdAt) >= df)) return false;
    if (dt && !(new Date(it.createdAt) <= dt)) return false;
    if (locationId && String(it.locationId || '') !== String(locationId)) return false;
    return true;
  });
}

function computeGroups(items) {
  const groupsMap = new Map(); // cashRegisterId => { income, expense, refund }
  const totals = { income: 0, expense: 0, refund: 0 };
  items.forEach((it) => {
    const id = String(it.cashRegisterId || '');
    if (!groupsMap.has(id)) groupsMap.set(id, { cashRegisterId: id, income: 0, expense: 0, refund: 0 });
    const g = groupsMap.get(id);
    const amt = Number(it.amount || 0);
    if (it.type === 'income') { g.income += amt; totals.income += amt; }
    else if (it.type === 'expense') { g.expense += amt; totals.expense += amt; }
    else if (it.type === 'refund') { g.refund += amt; totals.refund += amt; }
  });
  const groups = Array.from(groupsMap.values()).map((g) => ({
    cashRegisterId: g.cashRegisterId,
    totals: { income: g.income, expense: g.expense, refund: g.refund, balance: g.income - g.expense - g.refund },
  }));
  const balance = totals.income - totals.expense - totals.refund;
  return { groups, balance };
}

// GET /api/reports/cashflow — группировки по cashRegisterId и type; filter by dateFrom/dateTo, optional locationId
router.get('/cashflow', requirePermission('payments.read'), async (req, res) => {
  const { dateFrom, dateTo, locationId } = req.query || {};

  if (DEV_MODE && !mongoReady()) {
    try {
      const devStore = require('../services/devPaymentsStore');
      const items = filterDev(devStore.getItems(), { dateFrom, dateTo, locationId });
      const { groups, balance } = computeGroups(items);
      return res.json({ ok: true, groups, balance });
    } catch (err) {
      console.error('[reports.cashflow][DEV] error', err);
      return res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }

  if (!Payment) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const match = {};
    const df = parseDate(dateFrom);
    const dt = parseDate(dateTo);
    if (df || dt) {
      match.createdAt = {};
      if (df) match.createdAt.$gte = df;
      if (dt) match.createdAt.$lte = dt;
    }
    if (locationId) {
      try { match.locationId = new mongoose.Types.ObjectId(String(locationId)); } catch (_) {}
    }

    const agg = await Payment.aggregate([
      { $match: match },
      { $group: { _id: { cashRegisterId: '$cashRegisterId', type: '$type' }, sum: { $sum: '$amount' } } },
    ]);

    const groupsMap = new Map();
    let totalIncome = 0; let totalExpense = 0; let totalRefund = 0;
    agg.forEach((row) => {
      const id = String(row._id.cashRegisterId || '');
      const type = row._id.type;
      const sum = Number(row.sum || 0);
      if (!groupsMap.has(id)) groupsMap.set(id, { cashRegisterId: id, income: 0, expense: 0, refund: 0 });
      const g = groupsMap.get(id);
      if (type === 'income') { g.income += sum; totalIncome += sum; }
      else if (type === 'expense') { g.expense += sum; totalExpense += sum; }
      else if (type === 'refund') { g.refund += sum; totalRefund += sum; }
    });
    const groups = Array.from(groupsMap.values()).map((g) => ({
      cashRegisterId: g.cashRegisterId,
      totals: { income: g.income, expense: g.expense, refund: g.refund, balance: g.income - g.expense - g.refund },
    }));
    const balance = totalIncome - totalExpense - totalRefund;
    return res.json({ ok: true, groups, balance });
  } catch (err) {
    console.error('[reports.cashflow] error', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;