const mongoose = require('mongoose');

let StockBalance; let StockOperation;
try { StockBalance = require('../../models/stock/StockBalance'); } catch (e) {}
try { StockOperation = require('../../models/stock/StockOperation'); } catch (e) {}

const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;
const httpError = (statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; };

function parseDate(val) {
  const d = val ? new Date(String(val)) : null;
  return d && !isNaN(d) ? d : null;
}

// GET stocks summary by location
async function summaryByLocation({ limit = 10 } = {}) {
  if (!StockBalance) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) return { ok: true, groups: [], totalQty: 0 };

  const agg = await StockBalance.aggregate([
    { $group: { _id: '$locationId', sumQty: { $sum: '$quantity' }, sumReserved: { $sum: '$reservedQuantity' } } },
    { $sort: { sumQty: -1 } },
    { $limit: Math.max(1, Math.min(200, Number(limit) || 10)) },
  ]);

  const groups = agg.map((row) => ({
    locationId: row._id ? String(row._id) : undefined,
    totals: { qty: Number(row.sumQty || 0), reserved: Number(row.sumReserved || 0), available: Number(row.sumQty || 0) - Number(row.sumReserved || 0) },
  }));
  const totalQty = groups.reduce((acc, g) => acc + g.totals.qty, 0);
  return { ok: true, groups, totalQty };
}

// GET stocks turnover for period
async function turnover({ from, to, limit = 10 } = {}) {
  if (!StockOperation) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) return { ok: true, totals: { in: 0, out: 0, net: 0 }, byItem: [] };

  const match = {};
  const df = parseDate(from);
  const dt = parseDate(to);
  if (df || dt) {
    match.createdAt = {};
    if (df) match.createdAt.$gte = df;
    if (dt) match.createdAt.$lte = dt;
  }

  const totalsAgg = await StockOperation.aggregate([
    { $match: match },
    { $group: { _id: '$type', sum: { $sum: '$qty' } } },
  ]);
  let totalIn = 0; let totalOut = 0;
  totalsAgg.forEach((row) => {
    const t = String(row._id || '');
    const s = Number(row.sum || 0);
    if (t === 'in' || t === 'return') totalIn += s;
    else if (t === 'out') totalOut += s;
  });

  const byItemAgg = await StockOperation.aggregate([
    { $match: match },
    { $group: { _id: { itemId: '$itemId', type: '$type' }, sum: { $sum: '$qty' } } },
  ]);
  const map = new Map();
  byItemAgg.forEach((row) => {
    const id = String(row._id.itemId || '');
    const t = String(row._id.type || '');
    const s = Number(row.sum || 0);
    const cur = map.get(id) || { itemId: id, in: 0, out: 0 };
    if (t === 'in' || t === 'return') cur.in += s; else if (t === 'out') cur.out += s;
    map.set(id, cur);
  });
  const byItem = Array.from(map.values())
    .map((g) => ({ itemId: g.itemId, in: g.in, out: g.out, net: g.in - g.out }))
    .sort((a, b) => (b.in + b.out) - (a.in + a.out))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 10)));

  return { ok: true, totals: { in: totalIn, out: totalOut, net: totalIn - totalOut }, byItem };
}

module.exports = { summaryByLocation, turnover };