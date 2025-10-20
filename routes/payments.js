const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const { isPaymentsLocked, getDevState } = require('../services/statusActionsHandler');
const { requireAnyRole } = require('../middleware/auth');

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// POST /api/payments — create payment (guard PAYMENTS_LOCKED)
router.post('/', requireAnyRole(['Finance', 'Admin']), async (req, res, next) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return next(httpError(400, 'orderId is required'));

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (mongoReady) {
      const order = await Order.findById(orderId).lean();
      if (!order) return next(httpError(404, 'Order not found'));
      if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
        return next(httpError(400, 'PAYMENTS_LOCKED'));
      }
      if (order.closed && order.closed.success === true) {
        return next(httpError(400, 'ORDER_CLOSED'));
      }
      // Normally we would create a payment record here.
      return res.json({ ok: true, id: `pay-${Date.now()}` });
    }

    // DEV fallback: use in-memory flags
    const st = getDevState(orderId);
    const locked = !!(st && (st.paymentsLocked || (st.closed && st.closed.success === false)));
    if (locked) return next(httpError(400, 'PAYMENTS_LOCKED'));

    return res.json({ ok: true, id: `pay-${Date.now()}` });
  } catch (err) {
    return next(err);
  }
});

// POST /api/payments/refund — create refund (same guard)
router.post('/refund', requireAnyRole(['Finance', 'Admin']), async (req, res, next) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return next(httpError(400, 'orderId is required'));

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (mongoReady) {
      const order = await Order.findById(orderId).lean();
      if (!order) return next(httpError(404, 'Order not found'));
      if (order.paymentsLocked === true || (order.closed && order.closed.success === false)) {
        return next(httpError(400, 'PAYMENTS_LOCKED'));
      }
      if (order.closed && order.closed.success === true) {
        return next(httpError(400, 'ORDER_CLOSED'));
      }
      // Refund creation stub
      return res.json({ ok: true, id: `refund-${Date.now()}` });
    }

    // DEV fallback
    const st = getDevState(orderId);
    const locked = !!(st && (st.paymentsLocked || (st.closed && st.closed.success === false)));
    if (locked) return next(httpError(400, 'PAYMENTS_LOCKED'));

    return res.json({ ok: true, id: `refund-${Date.now()}` });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;