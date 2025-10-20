const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const { requireRole, requireRoles } = require('../middleware/auth');
const { changeOrderStatus } = require('../services/orderStatusService');
const OrderStatusLog = require('../models/OrderStatusLog');
const { enqueueStatusActions } = require('../queues/statusActionQueue');
const Order = require('../models/Order');
const { getDevState } = require('../services/statusActionsHandler');

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
// In-memory status logs for DEV mode without Mongo
const memStatusLogs = new Map(); // orderId => [logs]

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// GET /api/orders/:id/status-logs — return logs sorted by createdAt desc
router.get('/:id/status-logs', async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;

    if (DEV_MODE && !mongoReady) {
      const logs = (memStatusLogs.get(orderId) || []).slice();
      logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(logs);
    }

    const logs = await OrderStatusLog.find({ orderId }).sort({ createdAt: -1 }).lean();
    return res.json(logs);
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id/files — list attached files
router.get('/:id/files', requireRoles('docs.print', 'Admin'), async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (DEV_MODE && !mongoReady) {
      const st = getDevState ? getDevState(orderId) : null;
      const files = Array.isArray(st?.files) ? st.files : [];
      return res.json({ ok: true, files });
    }
    const order = await Order.findById(orderId).lean();
    if (!order) return next(httpError(404, 'Order not found'));
    const files = Array.isArray(order.files) ? order.files : [];
    return res.json({ ok: true, files });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id/status — change order status and log
router.patch('/:id/status', requireRole('orders.changeStatus'), async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const {
      newStatusCode, code, note, userId: userIdBody, prevStatusCode, prevStatus, from, actions: actionsFromBody,
    } = req.body || {};
    const finalCode = newStatusCode || code;
    if (!finalCode) return next(httpError(400, 'newStatusCode is required'));

    // userId from auth context (supports id or _id)
    const userId = (req.user && (req.user._id || req.user.id)) || userIdBody;
    if (!userId) return next(httpError(400, 'userId is required'));

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (DEV_MODE && !mongoReady) {
      const roles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : ((req.user && req.user.role) ? [req.user.role] : []);
      const canReopen = roles.includes('orders.reopen');
      const fromCode = from || prevStatusCode || prevStatus || null;
      // For DEV, treat 'closed_paid' and 'closed_unpaid' as closed_* groups
      const fromIsClosed = fromCode === 'closed_paid' || fromCode === 'closed_unpaid';
      if (fromIsClosed && !canReopen) {
        return next(httpError(403, 'REOPEN_FORBIDDEN'));
      }

      const defaultActions = finalCode === 'closed_paid' ? [{ type: 'payrollAccrual' }] : (finalCode === 'closed_unpaid' ? [{ type: 'closeWithoutPayment' }] : []);
      const actions = Array.isArray(actionsFromBody) && actionsFromBody.length ? actionsFromBody : defaultActions;
      const closed = finalCode === 'closed_paid'
        ? { success: true, at: new Date().toISOString(), by: userId }
        : (finalCode === 'closed_unpaid' ? { success: false, at: new Date().toISOString(), by: userId } : undefined);
      const log = {
        orderId,
        from: fromCode,
        to: finalCode,
        userId,
        userName: (req.user && req.user.name) || null,
        note: note || '',
        actionsEnqueued: actions,
        createdAt: new Date().toISOString(),
      };
      const arr = memStatusLogs.get(orderId) || [];
      arr.push(log);
      memStatusLogs.set(orderId, arr);
      const logId = `dev-${Date.now()}`;
      if (actions && actions.length > 0) {
        try {
          await enqueueStatusActions({
            orderId, statusCode: finalCode, actions, logId, userId,
          });
        } catch (e) { /* already logged inside enqueue; continue */ }
      }
      console.log('[DEV] status change simulated, actions:', actions.map((a) => a.type));
      return res.json({ ok: true, log, closed });
    }

    const roles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : ((req.user && req.user.role) ? [req.user.role] : []);
    const result = await changeOrderStatus({
      orderId, newStatusCode: finalCode, userId, note, roles, user: req.user,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;