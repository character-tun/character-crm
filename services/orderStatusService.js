const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const OrderStatusLog = require('../models/OrderStatusLog');
const { enqueueStatusActions } = require('../queues/statusActionQueue');
let OrderType; try { OrderType = require('../server/models/OrderType'); } catch (e) {}

/**
 * changeOrderStatus
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.newStatusCode
 * @param {string} params.userId
 * @param {string} [params.note]
 * @returns {Promise<{ok:true}>}
 */
async function changeOrderStatus({ orderId, newStatusCode, userId, note, roles = [], user = null }) {
  if (!orderId || !newStatusCode || !userId) {
    const err = new Error('orderId, newStatusCode, userId are required');
    err.statusCode = 400;
    throw err;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  // Determine permissions: role array from explicit param or user context
  const userRoles = Array.isArray(roles) && roles.length ? roles : (user && Array.isArray(user.roles) ? user.roles : (user && user.role ? [user.role] : []));
  const canReopen = userRoles.includes('orders.reopen');

  // If current status is closed_* group and user lacks orders.reopen — forbid
  if (order.status) {
    const curStatus = await OrderStatus.findOne({ code: order.status }).lean();
    if (curStatus && (curStatus.group === 'closed_success' || curStatus.group === 'closed_fail') && !canReopen) {
      const err = new Error('REOPEN_FORBIDDEN');
      err.statusCode = 403;
      throw err;
    }
  }

  const status = await OrderStatus.findOne({ code: newStatusCode }).lean();
  if (!status) {
    const err = new Error('Status not found');
    err.statusCode = 404;
    throw err;
  }

  // Enforce OrderType.allowedStatuses constraint when order has a type
  if (OrderType && order.orderTypeId) {
    const type = await OrderType.findById(order.orderTypeId).lean();
    if (type) {
      const allowed = Array.isArray(type.allowedStatuses) ? type.allowedStatuses : [];
      const isAllowed = allowed.some((id) => String(id) === String(status._id));
      if (!isAllowed) {
        const err = new Error('STATUS_NOT_ALLOWED');
        err.statusCode = 409;
        throw err;
      }
    }
  }

  const from = order.status || null;
  const to = status.code;
  const now = new Date();

  // Update order status and timestamp
  order.status = to;
  order.statusChangedAt = now;

  // Update closed block based on status group
  if (status.group === 'closed_success') {
    order.closed = { success: true, at: now, by: new mongoose.Types.ObjectId(userId) };
  } else if (status.group === 'closed_fail') {
    order.closed = { success: false, at: now, by: new mongoose.Types.ObjectId(userId) };
  } else {
    order.closed = undefined;
  }

  await order.save();

  // Create status change log
  const log = await OrderStatusLog.create({
    orderId: new mongoose.Types.ObjectId(orderId),
    from,
    to,
    userId: new mongoose.Types.ObjectId(userId),
    note: note || '',
    actionsEnqueued: Array.isArray(status.actions) ? status.actions : [],
  });

  // Enqueue auto-actions (do not break status change on enqueue error)
  try {
    await enqueueStatusActions({
      orderId,
      statusCode: status.code,
      actions: Array.isArray(status.actions) ? status.actions : [],
      logId: log._id.toString(),
      userId,
    });
  } catch (err) {
    console.error('[statusActionQueue] enqueue error', err);
  }

  return { ok: true };
}

module.exports = { changeOrderStatus };