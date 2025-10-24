const mongoose = require('mongoose');

let Order; try { Order = require('../models/Order'); } catch (_) {}
let Payment; try { Payment = require('../server/models/Payment'); } catch (_) {}
let CashRegister; try { CashRegister = require('../server/models/CashRegister'); } catch (_) {}
let OrderStatusLog; try { OrderStatusLog = require('../models/OrderStatusLog'); } catch (_) {}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function recordAudit(orderId, userId, note) {
  try {
    if (!OrderStatusLog) return;
    const payload = {
      orderId: new mongoose.Types.ObjectId(String(orderId)),
      from: 'payments',
      to: 'payments',
      userId: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
      note,
    };
    await OrderStatusLog.create(payload);
  } catch (e) {
    console.warn('[paymentsService] AuditLog failed:', e && e.message ? e.message : e);
  }
}

async function ensureCashRegister(cashRegisterId) {
  if (!CashRegister) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  if (cashRegisterId) {
    const cash = await CashRegister.findById(cashRegisterId).lean();
    if (!cash) throw httpError(404, 'CASH_NOT_FOUND');
    return cash._id;
  }
  let cash = await CashRegister.findOne({ defaultForLocation: true }).lean().catch(() => null);
  if (!cash) { cash = await CashRegister.findOne({ isSystem: true, code: 'main' }).lean().catch(() => null); }
  if (!cash) { cash = await CashRegister.findOne({}).lean().catch(() => null); }
  if (!cash || !cash._id) throw httpError(404, 'CASH_NOT_FOUND');
  return cash._id;
}

async function createPayment(dto, user) {
  if (!Payment || !Order) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  const body = dto || {};
  const { orderId, type, articlePath, amount, cashRegisterId, method, note, locationId } = body;

  const order = await Order.findById(orderId).lean();
  if (!order) throw httpError(404, 'Order not found');
  if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
    throw httpError(400, 'PAYMENTS_LOCKED');
  }
  if (order.closed && order.closed.success === true) {
    throw httpError(400, 'ORDER_CLOSED');
  }

  const t = typeof type === 'string' && ['income','expense','refund'].includes(type) ? type : 'income';
  const ap = Array.isArray(articlePath) && articlePath.length > 0
    ? articlePath
    : (t === 'refund' ? ['Возвраты'] : (t === 'expense' ? ['Расходы'] : ['Продажи','Касса']));
  const amt = typeof amount === 'number' ? amount : 0;
  if (!(amt > 0)) throw httpError(400, 'VALIDATION_ERROR');

  const cashId = await ensureCashRegister(cashRegisterId);

  const payload = {
    orderId: new mongoose.Types.ObjectId(orderId),
    type: t,
    articlePath: ap,
    amount: amt,
    cashRegisterId: new mongoose.Types.ObjectId(cashId),
    method: typeof method === 'string' ? method : 'manual',
    note,
    createdBy: user && user.id ? new mongoose.Types.ObjectId(user.id) : undefined,
    locationId: locationId ? new mongoose.Types.ObjectId(locationId) : (order.locationId ? new mongoose.Types.ObjectId(order.locationId) : undefined),
  };
  const created = await Payment.create(payload);
  await recordAudit(orderId, user && user.id, `PAYMENT_CREATE id=${created._id} type=${t} amount=${amt}`);
  return { ok: true, id: created._id };
}

async function updatePayment(id, dto, user) {
  if (!Payment || !Order) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  const patch = dto || {};
  const current = await Payment.findById(id).lean();
  if (!current) throw httpError(404, 'NOT_FOUND');

  if (current.orderId) {
    const order = await Order.findById(current.orderId).lean();
    if (!order) throw httpError(404, 'Order not found');
    if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
      throw httpError(403, 'PAYMENTS_LOCKED');
    }
    if (order.closed && order.closed.success === true) {
      throw httpError(403, 'ORDER_CLOSED');
    }
  }

  if (typeof patch.type === 'string') throw httpError(400, 'VALIDATION_ERROR');
  if (typeof patch.locked !== 'undefined' || typeof patch.lockedAt !== 'undefined') throw httpError(400, 'VALIDATION_ERROR');

  if (patch.cashRegisterId) {
    await ensureCashRegister(patch.cashRegisterId);
  }

  const item = await Payment.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
  if (!item) throw httpError(404, 'NOT_FOUND');
  await recordAudit(item.orderId, user && user.id, `PAYMENT_UPDATE id=${id} fields=${Object.keys(patch).join(',')}`);
  return { ok: true, item };
}

async function refundPayment(sourceId, dto, user) {
  if (!Payment || !Order) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  const body = dto || {};
  const { orderId, articlePath, amount, cashRegisterId, method, note, locationId } = body;

  const order = await Order.findById(orderId).lean();
  if (!order) throw httpError(404, 'Order not found');
  if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
    throw httpError(400, 'PAYMENTS_LOCKED');
  }
  if (order.closed && order.closed.success === true) {
    throw httpError(400, 'ORDER_CLOSED');
  }

  const ap = Array.isArray(articlePath) && articlePath.length > 0 ? articlePath : ['Возвраты'];
  const amt = typeof amount === 'number' ? amount : 0;
  if (!(amt > 0)) throw httpError(400, 'VALIDATION_ERROR');

  const cashId = await ensureCashRegister(cashRegisterId);

  const payload = {
    orderId: new mongoose.Types.ObjectId(orderId),
    type: 'refund',
    articlePath: ap,
    amount: amt,
    cashRegisterId: new mongoose.Types.ObjectId(cashId),
    method: typeof method === 'string' ? method : 'manual',
    note,
    createdBy: user && user.id ? new mongoose.Types.ObjectId(user.id) : undefined,
    locationId: locationId ? new mongoose.Types.ObjectId(locationId) : (order.locationId ? new mongoose.Types.ObjectId(order.locationId) : undefined),
  };
  const created = await Payment.create(payload);
  await recordAudit(orderId, user && user.id, `PAYMENT_REFUND id=${created._id} amount=${amt}${sourceId ? ` sourceId=${sourceId}` : ''}`);
  return { ok: true, id: created._id };
}

async function lockPayment(id, user) {
  if (!Payment) throw httpError(500, 'MODEL_NOT_AVAILABLE');
  const payment = await Payment.findById(id);
  if (!payment) throw httpError(404, 'NOT_FOUND');
  if (!payment.locked) {
    payment.locked = true;
    payment.lockedAt = new Date();
    await payment.save();
  }
  await recordAudit(payment.orderId, user && user.id, `PAYMENT_LOCK id=${id}`);
  return { ok: true, item: payment };
}

module.exports = {
  createPayment,
  updatePayment,
  refundPayment,
  lockPayment,
};