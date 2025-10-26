#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');

function parseArgs(argv) {
  const args = { dryRun: true, since: null, limit: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-dry-run') args.dryRun = false;
    else if (a.startsWith('--dry-run=')) {
      const v = a.split('=')[1];
      args.dryRun = v !== 'false';
    } else if (a === '--since') {
      const v = argv[i + 1];
      i += 1;
      args.since = v || null;
    } else if (a.startsWith('--since=')) {
      args.since = a.split('=')[1] || null;
    } else if (a === '--limit') {
      const v = argv[i + 1];
      i += 1;
      args.limit = v ? parseInt(v, 10) : null;
    } else if (a.startsWith('--limit=')) {
      const v = a.split('=')[1];
      args.limit = v ? parseInt(v, 10) : null;
    }
  }
  if (args.since) {
    const d = new Date(args.since);
    if (isNaN(d.getTime())) {
      console.warn('[migrate] invalid --since ISO date:', args.since);
      args.since = null;
    }
  }
  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    console.warn('[migrate] invalid --limit:', args.limit, '→ ignoring');
    args.limit = null;
  }
  return args;
}

function loadStatusMap() {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'status_map.json'),
    path.join(process.cwd(), 'status_map.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const obj = JSON.parse(raw);
        console.log('[migrate] status_map.json loaded from', p);
        return { map: obj || {}, path: p };
      } catch (e) {
        console.warn('[migrate] failed to load status_map.json', p, e.message);
        return { map: {}, path: p };
      }
    }
  }
  return { map: {}, path: null };
}

async function main() {
  const args = parseArgs(process.argv);
  const { dryRun, since, limit } = args;

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[migrate] Mongo connected');
  } catch (e) {
    console.warn('[migrate] Mongo connect failed:', e.message);
    // Continue anyway (dry-run can still produce report if we fetched nothing)
  }

  let statuses = [];
  try {
    statuses = await OrderStatus.find({}).lean();
  } catch (e) {
    console.warn('[migrate] failed to load OrderStatus list:', e.message);
    statuses = [];
  }
  const statusCodes = new Set(statuses.map((s) => s.code));
  const statusGroups = new Map(statuses.map((s) => [s.code, s.group]));

  const { map: statusMap, path: mapPath } = loadStatusMap();

  const filter = {};
  if (since) {
    const d = new Date(since);
    filter.$or = [
      { statusChangedAt: { $gte: d } },
      { createdAt: { $gte: d } },
    ];
  }

  let query = Order.find(filter);
  if (limit) query = query.limit(limit);

  const unknown = [];
  const errors = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let processedCount = 0;

  const now = new Date();

  const orders = await query.lean();
  for (const ord of orders) {
    processedCount += 1;
    const id = ord._id?.toString?.() || String(ord._id || '');
    try {
      // Clone mutable fields
      const updates = {};

      // Fill statusChangedAt if empty
      if (!ord.statusChangedAt) {
        updates.statusChangedAt = ord.createdAt ? new Date(ord.createdAt) : now;
      }

      // Resolve status code (with optional map)
      let code = ord.status || '';
      let mapped = null;
      if (code && !statusCodes.has(code) && statusMap && statusMap[code]) {
        mapped = statusMap[code];
        if (typeof mapped === 'string') code = mapped;
      }

      const known = code && statusCodes.has(code);
      if (!known) {
        // Unknown status → record to report, skip closed/payments updates
        unknown.push({ orderId: id, legacyStatus: ord.status || null, mappedStatus: mapped || null, createdAt: ord.createdAt || null, statusChangedAt: ord.statusChangedAt || null });
        // But still apply statusChangedAt fix if present
        if (updates.statusChangedAt && !dryRun) {
          await Order.updateOne({ _id: ord._id }, { $set: { statusChangedAt: updates.statusChangedAt } }).catch((e) => {
            errors.push({ orderId: id, error: e.message });
          });
          updatedCount += 1;
        } else if (updates.statusChangedAt) {
          // dry-run: count as would-update
          updatedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      // Closed flags update logic only if closed is empty
      const group = statusGroups.get(code);
      const willSetClosed = (!ord.closed || typeof ord.closed.success !== 'boolean') && (group === 'closed_success' || group === 'closed_fail');
      if (willSetClosed) {
        const at = ord.statusChangedAt ? new Date(ord.statusChangedAt) : (updates.statusChangedAt || now);
        updates.closed = { success: group === 'closed_success', at };
        if (group === 'closed_fail' && !ord.paymentsLocked) {
          updates.paymentsLocked = true;
        }
      }

      if (Object.keys(updates).length > 0) {
        if (dryRun) {
          updatedCount += 1;
        } else {
          await Order.updateOne({ _id: ord._id }, { $set: updates }).catch((e) => {
            errors.push({ orderId: id, error: e.message });
          });
          updatedCount += 1;
        }
      } else {
        skippedCount += 1;
      }
    } catch (e) {
      console.warn('[migrate] order error', id, e);
      errors.push({ orderId: id, error: e.message || String(e) });
      // do not throw
    }
  }

  // Prepare report
  const report = {
    at: new Date().toISOString(),
    args,
    mapPath,
    processed: processedCount,
    updated: updatedCount,
    skipped: skippedCount,
    unknownCount: unknown.length,
    unknown,
    errors,
  };

  const reportsDir = path.join(process.cwd(), 'storage', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const base = `migrateOrderStatuses-${Date.now()}`;
  const jsonPath = path.join(reportsDir, `${base}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const csvRows = ['orderId,legacyStatus,mappedStatus,createdAt,statusChangedAt'];
  for (const row of unknown) {
    const cells = [row.orderId, row.legacyStatus || '', row.mappedStatus || '', (row.createdAt ? new Date(row.createdAt).toISOString() : ''), (row.statusChangedAt ? new Date(row.statusChangedAt).toISOString() : '')];
    csvRows.push(cells.map((v) => String(v).replace(/"/g, '""')).join(','));
  }
  const csvPath = path.join(reportsDir, `${base}.csv`);
  fs.writeFileSync(csvPath, csvRows.join('\n'));

  console.log('[migrate] done', { updated: updatedCount, skipped: skippedCount, reportJson: jsonPath, reportCsv: csvPath });

  try { await mongoose.connection.close(); } catch {}
  process.exit(0);
}

main().catch((e) => {
  console.warn('[migrate] fatal error', e);
  process.exit(0);
});
