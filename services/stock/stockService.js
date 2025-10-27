const mongoose = require('mongoose');

let StockBalance; let StockOperation; let Order;
try { StockBalance = require('../../models/stock/StockBalance'); } catch (e) {}
try { StockOperation = require('../../models/stock/StockOperation'); } catch (e) {}
try { Order = require('../../models/Order'); } catch (e) {}

const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;
const httpError = (statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; };

function asObjId(id) {
  try { return new mongoose.Types.ObjectId(String(id)); } catch (e) { return undefined; }
}

async function listBalances({ itemId, locationId, limit = 50, offset = 0 }) {
  if (!StockBalance) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) return { ok: true, items: [] };
  const match = {};
  if (itemId) match.itemId = asObjId(itemId);
  if (locationId) match.locationId = asObjId(locationId);
  const items = await StockBalance.find(match).sort({ quantity: -1 }).skip(offset).limit(limit).lean();
  return { ok: true, items };
}

async function adjust({ itemId, locationId, qty, note, userId }) {
  if (!StockBalance || !StockOperation) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) throw httpError(503, 'DB_NOT_READY');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const itemObj = asObjId(itemId);
    const locObj = asObjId(locationId);
    const existing = await StockBalance.findOne({ itemId: itemObj, locationId: locObj }).session(session);
    const current = existing ? Number(existing.quantity || 0) : 0;
    const next = current + Number(qty || 0);
    if (next < 0) throw httpError(409, 'NEGATIVE_BALANCE_FORBIDDEN');

    // Upsert balance
    await StockBalance.updateOne(
      { itemId: itemObj, locationId: locObj },
      { $set: { lastUpdatedAt: new Date() }, $inc: { quantity: Number(qty || 0) } },
      { upsert: true, session }
    );

    // Operation: map adjust to in/out
    const opType = Number(qty || 0) >= 0 ? 'in' : 'out';
    const op = await StockOperation.create([
      {
        type: opType,
        itemId: itemObj,
        qty: Math.abs(Number(qty || 0)),
        locationIdFrom: opType === 'out' ? locObj : undefined,
        locationIdTo: opType === 'in' ? locObj : undefined,
        sourceType: 'manual',
        sourceId: undefined,
        performedBy: asObjId(userId),
        createdAt: new Date(),
      },
    ], { session });

    await session.commitTransaction();
    session.endSession();

    const updated = await StockBalance.findOne({ itemId: itemObj, locationId: locObj }).lean();
    return { ok: true, item: updated, operationId: op && op[0] && op[0]._id };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
}

async function transfer({ itemId, from, to, qty, note, userId }) {
  if (!StockBalance || !StockOperation) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) throw httpError(503, 'DB_NOT_READY');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const itemObj = asObjId(itemId);
    const fromObj = asObjId(from);
    const toObj = asObjId(to);

    const fromBal = await StockBalance.findOne({ itemId: itemObj, locationId: fromObj }).session(session);
    const fromQty = fromBal ? Number(fromBal.quantity || 0) : 0;
    if (fromQty < Number(qty || 0)) throw httpError(409, 'INSUFFICIENT_STOCK');

    await StockBalance.updateOne(
      { itemId: itemObj, locationId: fromObj },
      { $set: { lastUpdatedAt: new Date() }, $inc: { quantity: -Math.abs(Number(qty || 0)) } },
      { upsert: true, session }
    );
    await StockBalance.updateOne(
      { itemId: itemObj, locationId: toObj },
      { $set: { lastUpdatedAt: new Date() }, $inc: { quantity: Math.abs(Number(qty || 0)) } },
      { upsert: true, session }
    );

    const op = await StockOperation.create([
      {
        type: 'transfer',
        itemId: itemObj,
        qty: Math.abs(Number(qty || 0)),
        locationIdFrom: fromObj,
        locationIdTo: toObj,
        sourceType: 'manual',
        sourceId: undefined,
        performedBy: asObjId(userId),
        createdAt: new Date(),
      },
    ], { session });

    await session.commitTransaction();
    session.endSession();

    const fromUpdated = await StockBalance.findOne({ itemId: itemObj, locationId: fromObj }).lean();
    const toUpdated = await StockBalance.findOne({ itemId: itemObj, locationId: toObj }).lean();
    return { ok: true, items: [fromUpdated, toUpdated], operationId: op && op[0] && op[0]._id };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
}

async function issueFromOrder({ orderId, performedBy, locationId }) {
  if (!StockBalance || !StockOperation || !Order) return { ok: true, skipped: true };
  if (!mongoReady()) return { ok: true, skipped: true };

  const order = await Order.findById(orderId).lean();
  if (!order || !Array.isArray(order.items)) return { ok: true, processed: 0 };

  const loc = locationId ? asObjId(locationId) : (process.env.DEFAULT_STOCK_LOCATION_ID ? asObjId(process.env.DEFAULT_STOCK_LOCATION_ID) : undefined);
  if (!loc) return { ok: true, skipped: true };

  let processed = 0; const ops = [];
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const it of order.items) {
      const itemId = it && it.itemId; const qty = it && Number(it.qty || 0);
      if (!itemId || qty <= 0) continue;
      const itemObj = asObjId(itemId);

      // Idempotency: skip if operation exists
      const dup = await StockOperation.findOne({ type: 'out', sourceType: 'order', sourceId: asObjId(orderId), itemId: itemObj, qty }).session(session);
      if (dup) { processed += 1; continue; }

      const bal = await StockBalance.findOne({ itemId: itemObj, locationId: loc }).session(session);
      const current = bal ? Number(bal.quantity || 0) : 0;
      const reserved = bal ? Number(bal.reservedQuantity || 0) : 0;
      const decReserved = Math.min(reserved, Math.abs(qty));
      if (current < qty) throw httpError(409, 'INSUFFICIENT_STOCK');

      await StockBalance.updateOne(
        { itemId: itemObj, locationId: loc },
        { $set: { lastUpdatedAt: new Date() }, $inc: { quantity: -Math.abs(qty), reservedQuantity: -decReserved } },
        { upsert: true, session }
      );
      const op = await StockOperation.create([
        {
          type: 'out', itemId: itemObj, qty, locationIdFrom: loc, sourceType: 'order', sourceId: asObjId(orderId), performedBy: asObjId(performedBy), createdAt: new Date(),
        },
      ], { session });
      ops.push(op && op[0]);
      processed += 1;
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true, processed, operations: ops.map((o) => o && o._id).filter(Boolean) };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    return { ok: false, error: err && err.message, statusCode: err && err.statusCode };
  }
}

async function returnFromRefund({ orderId, paymentId, locationId, performedBy }) {
  if (!StockBalance || !StockOperation || !Order) return { ok: true, skipped: true };
  if (!mongoReady()) return { ok: true, skipped: true };

  const ord = await Order.findById(orderId).lean();
  if (!ord || !Array.isArray(ord.items)) return { ok: true, processed: 0 };

  const loc = locationId ? asObjId(locationId) : (ord.locationId ? asObjId(ord.locationId) : (process.env.DEFAULT_STOCK_LOCATION_ID ? asObjId(process.env.DEFAULT_STOCK_LOCATION_ID) : undefined));
  if (!loc) return { ok: true, skipped: true };

  let processed = 0; const ops = [];
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const it of ord.items) {
      const itemId = it && it.itemId; const qty = it && Number(it.qty || 0);
      if (!itemId || qty <= 0) continue;
      const itemObj = asObjId(itemId);

      // Idempotency: skip if return operation already linked to this payment
      const dup = await StockOperation.findOne({ type: 'return', sourceType: 'payment', sourceId: asObjId(paymentId), itemId: itemObj, qty }).session(session);
      if (dup) { processed += 1; continue; }

      await StockBalance.updateOne(
        { itemId: itemObj, locationId: loc },
        { $set: { lastUpdatedAt: new Date() }, $inc: { quantity: Math.abs(qty) } },
        { upsert: true, session }
      );
      const op = await StockOperation.create([
        {
          type: 'return', itemId: itemObj, qty, locationIdTo: loc, sourceType: 'payment', sourceId: asObjId(paymentId), performedBy: asObjId(performedBy), createdAt: new Date(),
        },
      ], { session });
      ops.push(op && op[0]);
      processed += 1;
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true, processed, operations: ops.map((o) => o && o._id).filter(Boolean) };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    return { ok: false, error: err && err.message, statusCode: err && err.statusCode };
  }
}

module.exports = { listBalances, adjust, transfer, issueFromOrder, returnFromRefund };