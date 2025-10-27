const mongoose = require('mongoose');

let StockBalance; let Order;
try { StockBalance = require('../../models/stock/StockBalance'); } catch (e) {}
try { Order = require('../../models/Order'); } catch (e) {}

const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;
const httpError = (statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; };
function asObjId(id) { try { return new mongoose.Types.ObjectId(String(id)); } catch (e) { return undefined; } }

function normalizeItems(items) {
  const map = new Map();
  const arr = Array.isArray(items) ? items : [];
  for (const it of arr) {
    const id = it && it.itemId;
    const qty = Number((it && it.qty) || 0);
    if (!id || qty <= 0) continue;
    const key = String(id);
    const prev = map.get(key) || 0;
    map.set(key, prev + qty);
  }
  return map; // key:string itemId -> total qty
}

// Reserve: increase reservedQuantity for order items; forbid negative available
async function reserveForOrder({ orderId, locationId, userId }) {
  if (!StockBalance || !Order) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) throw httpError(503, 'DB_NOT_READY');
  const order = await Order.findById(orderId).lean();
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return { ok: true, reserved: 0 };
  const loc = locationId ? asObjId(locationId) : (process.env.DEFAULT_STOCK_LOCATION_ID ? asObjId(process.env.DEFAULT_STOCK_LOCATION_ID) : undefined);
  if (!loc) return { ok: true, skipped: true };

  const itemsMap = normalizeItems(order.items);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let count = 0;
    for (const [itemIdStr, qty] of itemsMap.entries()) {
      const itemObj = asObjId(itemIdStr);
      const bal = await StockBalance.findOne({ itemId: itemObj, locationId: loc }).session(session);
      const quantity = bal ? Number(bal.quantity || 0) : 0;
      const reserved = bal ? Number(bal.reservedQuantity || 0) : 0;
      const available = quantity - reserved;
      if (available < qty) throw httpError(409, 'INSUFFICIENT_STOCK');
      await StockBalance.updateOne(
        { itemId: itemObj, locationId: loc },
        { $set: { lastUpdatedAt: new Date() }, $inc: { reservedQuantity: Math.abs(qty) } },
        { upsert: true, session }
      );
      count += 1;
    }
    await session.commitTransaction();
    session.endSession();
    return { ok: true, reserved: count };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
}

// Release: decrease reservedQuantity for order items (clamp to >=0)
async function releaseForOrder({ orderId, locationId, userId }) {
  if (!StockBalance || !Order) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) throw httpError(503, 'DB_NOT_READY');
  const order = await Order.findById(orderId).lean();
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return { ok: true, released: 0 };
  const loc = locationId ? asObjId(locationId) : (process.env.DEFAULT_STOCK_LOCATION_ID ? asObjId(process.env.DEFAULT_STOCK_LOCATION_ID) : undefined);
  if (!loc) return { ok: true, skipped: true };

  const itemsMap = normalizeItems(order.items);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let count = 0;
    for (const [itemIdStr, qty] of itemsMap.entries()) {
      const itemObj = asObjId(itemIdStr);
      const bal = await StockBalance.findOne({ itemId: itemObj, locationId: loc }).session(session);
      const reserved = bal ? Number(bal.reservedQuantity || 0) : 0;
      const nextReserved = Math.max(0, reserved - Math.abs(qty));
      await StockBalance.updateOne(
        { itemId: itemObj, locationId: loc },
        { $set: { lastUpdatedAt: new Date(), reservedQuantity: nextReserved } },
        { upsert: true, session }
      );
      count += 1;
    }
    await session.commitTransaction();
    session.endSession();
    return { ok: true, released: count };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
}

// Edit diff: apply reservation changes based on items delta
async function applyDiffForOrderEdit({ orderId, prevItems, nextItems, locationId, userId }) {
  if (!StockBalance) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (!mongoReady()) throw httpError(503, 'DB_NOT_READY');
  const loc = locationId ? asObjId(locationId) : (process.env.DEFAULT_STOCK_LOCATION_ID ? asObjId(process.env.DEFAULT_STOCK_LOCATION_ID) : undefined);
  if (!loc) return { ok: true, skipped: true };

  const prevMap = normalizeItems(prevItems);
  const nextMap = normalizeItems(nextItems);
  const allKeys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let adjusted = 0;
    for (const key of allKeys) {
      const prevQty = prevMap.get(key) || 0;
      const nextQty = nextMap.get(key) || 0;
      const delta = nextQty - prevQty;
      if (delta === 0) continue;
      const itemObj = asObjId(key);
      const bal = await StockBalance.findOne({ itemId: itemObj, locationId: loc }).session(session);
      const quantity = bal ? Number(bal.quantity || 0) : 0;
      const reserved = bal ? Number(bal.reservedQuantity || 0) : 0;
      if (delta > 0) {
        const available = quantity - reserved;
        if (available < delta) throw httpError(409, 'INSUFFICIENT_STOCK');
        await StockBalance.updateOne(
          { itemId: itemObj, locationId: loc },
          { $set: { lastUpdatedAt: new Date() }, $inc: { reservedQuantity: Math.abs(delta) } },
          { upsert: true, session }
        );
      } else {
        const nextReserved = Math.max(0, reserved - Math.abs(delta));
        await StockBalance.updateOne(
          { itemId: itemObj, locationId: loc },
          { $set: { lastUpdatedAt: new Date(), reservedQuantity: nextReserved } },
          { upsert: true, session }
        );
      }
      adjusted += 1;
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true, adjusted };
  } catch (err) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    throw err;
  }
}

module.exports = { reserveForOrder, releaseForOrder, applyDiffForOrderEdit };