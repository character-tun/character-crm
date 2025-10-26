const express = require('express');
const mongoose = require('mongoose');
const { requirePermission, requireRoles } = require('../middleware/auth');

let Payment; try { Payment = require('../server/models/Payment'); } catch (e) {}
let StockLedger; try { StockLedger = require('../server/models/StockLedger'); } catch (e) {}
let PayrollAccrual; try { PayrollAccrual = require('../server/models/PayrollAccrual'); } catch (e) {}
let devPayrollStore; try { devPayrollStore = require('../services/devPayrollStore'); } catch (_) {}

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
    if (it.type === 'income') { g.income += amt; totals.income += amt; } else if (it.type === 'expense') { g.expense += amt; totals.expense += amt; } else if (it.type === 'refund') { g.refund += amt; totals.refund += amt; }
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
      const { type } = row._id;
      const sum = Number(row.sum || 0);
      if (!groupsMap.has(id)) groupsMap.set(id, { cashRegisterId: id, income: 0, expense: 0, refund: 0 });
      const g = groupsMap.get(id);
      if (type === 'income') { g.income += sum; totalIncome += sum; } else if (type === 'expense') { g.expense += sum; totalExpense += sum; } else if (type === 'refund') { g.refund += sum; totalRefund += sum; }
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

// GET /api/reports/stock-turnover — агрегирование движений склада по товару/локации
router.get('/stock-turnover', requirePermission('warehouse.read'), async (req, res) => {
  const { dateFrom, dateTo, locationId } = req.query || {};

  if (DEV_MODE && !mongoReady()) {
    // DEV: ledger store is not shared; return empty summary for now
    return res.json({ ok: true, groups: [], totals: { receiptQty: 0, issueQty: 0, inventoryQty: 0, netQty: 0 } });
  }

  if (!StockLedger) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const match = {};
    const df = parseDate(dateFrom);
    const dt = parseDate(dateTo);
    if (df || dt) {
      match.ts = {};
      if (df) match.ts.$gte = df;
      if (dt) match.ts.$lte = dt;
    }
    if (locationId) {
      try { match.locationId = new mongoose.Types.ObjectId(String(locationId)); } catch (_) {}
    }

    const agg = await StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: { itemId: '$itemId', locationId: '$locationId' },
          receiptQty: { $sum: { $cond: [{ $in: ['$op', ['receipt', 'transfer_in']] }, '$qty', 0] } },
          issueQty: { $sum: { $cond: [{ $in: ['$op', ['issue', 'transfer_out']] }, '$qty', 0] } },
          inventoryQty: { $sum: { $cond: [{ $eq: ['$op', 'inventory'] }, '$qty', 0] } },
          receiptCost: { $sum: { $cond: [{ $in: ['$op', ['receipt', 'transfer_in']] }, '$cost', 0] } },
          issueCost: { $sum: { $cond: [{ $in: ['$op', ['issue', 'transfer_out']] }, '$cost', 0] } },
          inventoryCost: { $sum: { $cond: [{ $eq: ['$op', 'inventory'] }, '$cost', 0] } },
        },
      },
    ]);

    const groups = agg.map((row) => {
      const netQty = Number(row.receiptQty || 0) - Number(row.issueQty || 0) + Number(row.inventoryQty || 0);
      const netCost = Number(row.receiptCost || 0) - Number(row.issueCost || 0) + Number(row.inventoryCost || 0);
      return {
        itemId: String(row._id.itemId || ''),
        locationId: row._id.locationId ? String(row._id.locationId) : undefined,
        totals: {
          receiptQty: Number(row.receiptQty || 0),
          issueQty: Number(row.issueQty || 0),
          inventoryQty: Number(row.inventoryQty || 0),
          netQty,
          receiptCost: Number(row.receiptCost || 0),
          issueCost: Number(row.issueCost || 0),
          inventoryCost: Number(row.inventoryCost || 0),
          netCost,
        },
      };
    });

    const totals = groups.reduce((acc, g) => ({
      receiptQty: acc.receiptQty + g.totals.receiptQty,
      issueQty: acc.issueQty + g.totals.issueQty,
      inventoryQty: acc.inventoryQty + g.totals.inventoryQty,
      netQty: acc.netQty + g.totals.netQty,
    }), { receiptQty: 0, issueQty: 0, inventoryQty: 0, netQty: 0 });

    return res.json({ ok: true, groups, totals });
  } catch (err) {
    console.error('[reports.stock-turnover] error', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// GET /api/reports/payroll-summary — агрегирование начислений по сотрудникам
router.get('/payroll-summary', requireRoles('Admin', 'Manager', 'Finance'), async (req, res) => {
  const { dateFrom, dateTo } = req.query || {};

  if (DEV_MODE && !mongoReady()) {
    const items = devPayrollStore ? devPayrollStore.getItems() : [];
    const filtered = filterDev(items, { dateFrom, dateTo });
    const map = new Map();
    filtered.forEach((it) => {
      const id = String(it.employeeId || '') || 'unknown';
      const cur = map.get(id) || { employeeId: id, amount: 0, count: 0 };
      cur.amount += Number(it.amount || 0);
      cur.count += 1;
      map.set(id, cur);
    });
    const groups = Array.from(map.values());
    const total = groups.reduce((acc, g) => acc + g.amount, 0);
    return res.json({ ok: true, groups, total });
  }

  if (!PayrollAccrual) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const match = {};
    const df = parseDate(dateFrom);
    const dt = parseDate(dateTo);
    if (df || dt) {
      match.createdAt = {};
      if (df) match.createdAt.$gte = df;
      if (dt) match.createdAt.$lte = dt;
    }

    const agg = await PayrollAccrual.aggregate([
      { $match: match },
      { $group: { _id: '$employeeId', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const groups = agg.map((row) => ({ employeeId: String(row._id || ''), amount: Number(row.amount || 0), count: Number(row.count || 0) }));
    const total = groups.reduce((acc, g) => acc + g.amount, 0);
    return res.json({ ok: true, groups, total });
  } catch (err) {
    console.error('[reports.payroll-summary] error', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
