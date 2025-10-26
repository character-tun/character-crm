#!/usr/bin/env node
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../../config/db');

const Order = require('../../models/Order');
const OrderType = require('../../server/models/OrderType');

async function ensureDefaultOrderType() {
  // Try to find existing 'default' order type
  let created = false;
  let doc = await OrderType.findOne({ code: 'default' }).lean();
  if (!doc) {
    // Create minimal system type without statuses to avoid validation issues
    // (seed script may enrich startStatusId/allowedStatuses later)
    const createdDoc = await OrderType.create({
      code: 'default',
      name: 'Default',
      isSystem: true,
      allowedStatuses: [],
    });
    created = true;
    doc = createdDoc.toObject();
  }
  return { doc, created };
}

async function backfillOrders(defaultType) {
  // 1) Backfill orderTypeId where missing/null
  const setTypeRes = await Order.updateMany(
    {
      $or: [
        { orderTypeId: { $exists: false } },
        { orderTypeId: null },
      ],
    },
    { $set: { orderTypeId: defaultType._id } },
  );
  const orderTypeBackfilled = setTypeRes.modifiedCount ?? setTypeRes.nModified ?? 0;

  // 2) Backfill status from type.startStatusId when status missing and startStatusId present
  let statusBackfilled = 0;
  if (defaultType.startStatusId) {
    const setStatusRes = await Order.updateMany(
      {
        $and: [
          { orderTypeId: defaultType._id },
          { $or: [
            { status: { $exists: false } },
            { status: null },
            { status: '' },
          ] },
        ],
      },
      { $set: { status: defaultType.startStatusId } },
    );
    statusBackfilled = setStatusRes.modifiedCount ?? setStatusRes.nModified ?? 0;
  }

  return { orderTypeBackfilled, statusBackfilled };
}

(async function main() {
  const startedAt = new Date();
  try {
    await connectDB();

    const { doc: defaultType, created } = await ensureDefaultOrderType();

    const { orderTypeBackfilled, statusBackfilled } = await backfillOrders(defaultType);

    const summary = {
      ok: true,
      mongoConnected: true,
      defaultType: {
        id: String(defaultType._id),
        code: defaultType.code,
        created,
        hasStartStatus: Boolean(defaultType.startStatusId),
      },
      results: {
        orderTypeBackfilled,
        statusBackfilled,
        skippedStatusBackfillNoStartStatus: !defaultType.startStatusId,
      },
      when: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    };

    // Human-readable log
    console.log('[migration] OrderType backfill completed');
    console.log(`- default type: ${summary.defaultType.code} (${summary.defaultType.id}), created=${created}`);
    console.log(`- orders updated (orderTypeId): ${orderTypeBackfilled}`);
    console.log(`- orders updated (status): ${statusBackfilled}${!defaultType.startStatusId ? ' (skipped, no startStatusId in type)' : ''}`);

    // Machine-friendly JSON summary
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('[migration] failed:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch (_) { /* noop */ }
  }
})();
