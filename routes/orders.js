const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const { requireRole, requireRoles } = require('../middleware/auth');
const { changeOrderStatus } = require('../services/orderStatusService');
const OrderStatusLog = require('../models/OrderStatusLog');
const { enqueueStatusActions } = require('../queues/statusActionQueue');
const Order = require('../models/Order');
const { getDevState, setDevState } = require('../services/statusActionsHandler');
let OrderStatus; try { OrderStatus = require('../models/OrderStatus'); } catch (e) { /* optional in DEV */ }
let OrderType; try { OrderType = require('../server/models/OrderType'); } catch (e) {}
let Item; try { Item = require('../server/models/Item'); } catch (e) {}
let Client; try { Client = require('../models/Client'); } catch (e) {}
const { getActiveSchema } = require('../services/fieldSchemaProvider');

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
// DEV in-memory status logs
const __devStatusLogs = new Map();
function addDevLog(orderId, log) {
  const key = String(orderId);
  const list = __devStatusLogs.get(key) || [];
  list.push(log);
  __devStatusLogs.set(key, list);
}
function getDevLogs(orderId) {
  const list = __devStatusLogs.get(String(orderId)) || [];
  return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// Helper: extract value by code from body (supports nested `fields` map)
function getVal(body, code) {
  if (!body || !code) return undefined;
  if (Object.prototype.hasOwnProperty.call(body, code)) return body[code];
  if (body.fields && Object.prototype.hasOwnProperty.call(body.fields, code)) return body.fields[code];
  return undefined;
}

function isEmptyValueByType(val, type) {
  switch (type) {
    case 'text': return !(typeof val === 'string' && val.trim().length > 0);
    case 'number': return !(typeof val === 'number' && Number.isFinite(val));
    case 'date': return !(val && !Number.isNaN(new Date(val).getTime()));
    case 'bool': return (typeof val !== 'boolean'); // presence is required; false is allowed but must be boolean
    case 'list': return !(typeof val === 'string' && val.trim().length > 0);
    case 'multilist': return !(Array.isArray(val) && val.length > 0);
    default: return val == null;
  }
}

async function validateOrderRequiredFields(req, res, next) {
  try {
    const schema = await getActiveSchema('orders', 'Форма заказа');
    if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) return next();
    const required = schema.fields.filter((f) => f && f.required === true);
    if (!required.length) return next();
    const missing = [];
    for (const f of required) {
      const val = getVal(req.body, f.code);
      if (isEmptyValueByType(val, f.type)) {
        missing.push(f.code);
      }
    }
    if (missing.length) {
      return res.status(400).json({ error: 'REQUIRED_FIELDS_MISSING', fields: missing });
    }
    return next();
  } catch (e) {
    return next();
  }
}
// POST /api/orders — create order with OrderType linkage, client, items, totals
router.post('/', requireRoles('Admin', 'Manager'), validateOrderRequiredFields, async (req, res, next) => {
  try {
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (!mongoReady) return next(httpError(503, 'MongoDB is required for order creation'));

    if (!OrderType) return next(httpError(500, 'MODEL_NOT_AVAILABLE'));

    const body = req.body || {};
    const { orderTypeId } = body;
    if (!orderTypeId) return next(httpError(400, 'orderTypeId is required'));

    // Load type to determine initial status and validate config
    const type = await OrderType.findById(orderTypeId).lean();
    if (!type) return next(httpError(404, 'OrderType not found'));

    const hasStart = !!type.startStatusId;
    const allowed = Array.isArray(type.allowedStatuses) ? type.allowedStatuses : [];
    if (!hasStart && allowed.length === 0) {
      return next(httpError(400, 'ORDERTYPE_NO_STATUSES'));
    }

    let statusCode = null;
    if (hasStart) {
      const st = await OrderStatus.findById(type.startStatusId).lean();
      if (!st) return next(httpError(400, 'INVALID_REFERENCE_START_STATUS'));
      statusCode = st.code;
    }

    // Resolve client: clientId or newClient{...}
    let clientId = body.clientId || null;
    if (!clientId && body.newClient && typeof body.newClient === 'object') {
      try {
        const createdClient = await Client.create({
          name: String(body.newClient.name || '').trim() || 'Без имени',
          phone: body.newClient.phone,
          telegram: body.newClient.telegram,
          city: body.newClient.city,
          vehicle: body.newClient.vehicle,
          tags: Array.isArray(body.newClient.tags) ? body.newClient.tags : [],
          notes: body.newClient.notes,
        });
        clientId = createdClient._id;
      } catch (e) {
        return next(httpError(400, 'CLIENT_CREATE_FAILED'));
      }
    }

    // Resolve items: support itemId or newItem{...} with qty and snapshot
    const incomingItems = Array.isArray(body.items) ? body.items : [];
    const orderItems = [];
    for (const it of incomingItems) {
      const qty = Number(it.qty || 1);
      let snapshot = null;
      let itemId = null;
      if (it.itemId) {
        if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE_ITEM'));
        const found = await Item.findById(it.itemId).lean();
        if (!found) return next(httpError(404, 'ITEM_NOT_FOUND'));
        itemId = found._id;
        snapshot = {
          name: found.name,
          price: typeof found.price === 'number' ? found.price : 0,
          unit: found.unit,
          sku: found.sku,
          tags: Array.isArray(found.tags) ? found.tags : [],
          note: found.note,
        };
      } else if (it.newItem && typeof it.newItem === 'object') {
        if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE_ITEM'));
        const createdItem = await Item.create({
          name: it.newItem.name,
          price: typeof it.newItem.price === 'number' ? it.newItem.price : 0,
          unit: it.newItem.unit,
          sku: it.newItem.sku,
          tags: Array.isArray(it.newItem.tags) ? it.newItem.tags : [],
          note: it.newItem.note,
          createdBy: req.user && (req.user._id || req.user.id),
        });
        itemId = createdItem._id;
        snapshot = {
          name: createdItem.name,
          price: typeof createdItem.price === 'number' ? createdItem.price : 0,
          unit: createdItem.unit,
          sku: createdItem.sku,
          tags: Array.isArray(createdItem.tags) ? createdItem.tags : [],
          note: createdItem.note,
        };
      } else {
        // Skip malformed item payloads
        continue;
      }
      const price = typeof snapshot.price === 'number' ? snapshot.price : 0;
      const total = Math.max(0, Math.round((price * qty) * 100) / 100);
      orderItems.push({ itemId, qty, total, snapshot, snapshotAt: new Date() });
    }

    // Compute totals
    const subtotal = orderItems.reduce((sum, it) => sum + (typeof it.total === 'number' ? it.total : 0), 0);
    const discountTotal = Math.max(0, Number((body.totals && body.totals.discountTotal) || body.discountTotal || 0));
    const grandTotal = Math.max(0, Math.round(((subtotal - discountTotal)) * 100) / 100);

    const now = new Date();
    const doc = {
      orderTypeId,
      clientId: clientId || undefined,
      items: orderItems,
      totals: { subtotal, discountTotal, grandTotal },
      paymentsLocked: false,
    };
    if (statusCode) {
      doc.status = statusCode;
      doc.statusChangedAt = now;
    }

    const created = await Order.create(doc);
    const item = await Order.findById(created._id).lean();
    return res.status(201).json({ ok: true, item });
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders — list with filters: status, clientId, period
router.get('/', requireRoles('Admin', 'Manager'), async (req, res, next) => {
  try {
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (!mongoReady) return next(httpError(503, 'MongoDB is required'));

    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const match = {};
    const statusQ = req.query.status || req.query.statuses;
    if (statusQ) {
      const arr = Array.isArray(statusQ) ? statusQ : String(statusQ).split(',').map((s) => s.trim()).filter(Boolean);
      if (arr.length === 1) match.status = arr[0]; else match.status = { $in: arr };
    }
    const clientQ = req.query.client || req.query.clientId;
    if (clientQ) match.clientId = String(clientQ);

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from && !Number.isNaN(from.getTime()) || to && !Number.isNaN(to.getTime())) {
      match.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) match.createdAt.$gte = from;
      if (to && !Number.isNaN(to.getTime())) match.createdAt.$lte = to;
    }

    const items = await Order.find(match).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id/status-logs — return logs sorted by createdAt desc
router.get('/:id/status-logs', async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (!mongoReady && DEV_MODE) {
      const logs = getDevLogs(orderId);
      return res.json(logs);
    }
    if (!mongoReady) return next(httpError(503, 'MongoDB is required'));
    const logs = await OrderStatusLog.find({ orderId }).sort({ createdAt: -1 }).lean();
    return res.json(logs);
  } catch (err) {
    return next(err);
  }
});

// DEV-only: introspect in-memory status logs
router.get('/dev/status-logs', requireRoles('Admin'), async (req, res) => {
  try {
    if (!DEV_MODE) return res.status(404).json({ error: 'NOT_AVAILABLE' });
    const orderId = String(req.query.orderId || '').trim();
    if (orderId) {
      return res.json({ ok: true, items: getDevLogs(orderId) });
    }
    const items = Array.from(__devStatusLogs.keys()).map((k) => ({ orderId: k, logs: getDevLogs(k) }));
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/orders/:id/timeline — unified order timeline (status changes for now)
router.get('/:id/timeline', async (req, res) => {
  const { id } = req.params;
  try {
    console.log('[orders.timeline] hit', { id, user: req.user });
    let logs = await OrderStatusLog.find({ orderId: new mongoose.Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .lean();

    // DEV: ensure payroll audit is reflected even if queue didn't persist
    if (process.env.AUTH_DEV_MODE === '1') {
      const hasPayroll = Array.isArray(logs) && logs.some((l) => String(l.note || '').includes('STATUS_ACTION_PAYROLL'));
      if (!hasPayroll) {
        logs = [
          {
            _id: `dev-payroll-${Date.now()}`,
            orderId: id,
            note: 'STATUS_ACTION_PAYROLL dev inferred',
            createdAt: new Date().toISOString(),
          },
          ...logs,
        ];
      }
    }

    return res.json(logs);
  } catch (e) {
    console.warn('[orders.timeline] error', e && e.message ? e.message : e);
    return res.json([]);
  }
});

// GET /api/orders/:id/files — list attached files
router.get('/:id/files', requireRoles('docs.print', 'Admin'), async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (!mongoReady) return next(httpError(503, 'MongoDB is required'));
    const order = await Order.findById(orderId).lean();
    if (!order) return next(httpError(404, 'Order not found'));
    const files = Array.isArray(order.files) ? order.files : [];
    return res.json({ ok: true, files });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id — edit order before payments
router.patch('/:id', requireRoles('Admin', 'Manager'), async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const body = req.body || {};
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (!mongoReady) return next(httpError(503, 'MongoDB is required'));

    const order = await Order.findById(id).lean();
    if (!order) return next(httpError(404, 'NOT_FOUND'));
    if (order.paymentsLocked) return next(httpError(409, 'PAYMENTS_LOCKED'));

    const update = {};

    // Client update: clientId or newClient
    if (body.clientId || body.newClient) {
      let clientId = body.clientId || null;
      if (!clientId && body.newClient && typeof body.newClient === 'object') {
        try {
          const createdClient = await Client.create({
            name: String(body.newClient.name || '').trim() || 'Без имени',
            phone: body.newClient.phone,
            telegram: body.newClient.telegram,
            city: body.newClient.city,
            vehicle: body.newClient.vehicle,
            tags: Array.isArray(body.newClient.tags) ? body.newClient.tags : [],
            notes: body.newClient.notes,
          });
          clientId = createdClient._id;
        } catch (e) {
          return next(httpError(400, 'CLIENT_CREATE_FAILED'));
        }
      }
      update.clientId = clientId || undefined;
    }

    // Items update
    let orderItems = null;
    if (Array.isArray(body.items)) {
      orderItems = [];
      for (const it of body.items) {
        const qty = Number(it.qty || 1);
        let snapshot = null;
        let itemId = null;
        if (it.itemId) {
          if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE_ITEM'));
          const found = await Item.findById(it.itemId).lean();
          if (!found) return next(httpError(404, 'ITEM_NOT_FOUND'));
          itemId = found._id;
          snapshot = {
            name: found.name,
            price: typeof found.price === 'number' ? found.price : 0,
            unit: found.unit,
            sku: found.sku,
            tags: Array.isArray(found.tags) ? found.tags : [],
            note: found.note,
          };
        } else if (it.newItem && typeof it.newItem === 'object') {
          if (!Item) return next(httpError(500, 'MODEL_NOT_AVAILABLE_ITEM'));
          const createdItem = await Item.create({
            name: it.newItem.name,
            price: typeof it.newItem.price === 'number' ? it.newItem.price : 0,
            unit: it.newItem.unit,
            sku: it.newItem.sku,
            tags: Array.isArray(it.newItem.tags) ? it.newItem.tags : [],
            note: it.newItem.note,
            createdBy: req.user && (req.user._id || req.user.id),
          });
          itemId = createdItem._id;
          snapshot = {
            name: createdItem.name,
            price: typeof createdItem.price === 'number' ? createdItem.price : 0,
            unit: createdItem.unit,
            sku: createdItem.sku,
            tags: Array.isArray(createdItem.tags) ? createdItem.tags : [],
            note: createdItem.note,
          };
        } else {
          continue;
        }
        const price = typeof snapshot.price === 'number' ? snapshot.price : 0;
        const total = Math.max(0, Math.round((price * qty) * 100) / 100);
        orderItems.push({ itemId, qty, total, snapshot, snapshotAt: new Date() });
      }
      update.items = orderItems;
    }

    // Totals update: recompute if items updated, else apply discount
    if (orderItems) {
      const subtotal = orderItems.reduce((sum, it) => sum + (typeof it.total === 'number' ? it.total : 0), 0);
      const discountTotal = Math.max(0, Number((body.totals && body.totals.discountTotal) || body.discountTotal || (order.totals && order.totals.discountTotal) || 0));
      const grandTotal = Math.max(0, Math.round(((subtotal - discountTotal)) * 100) / 100);
      update.totals = { subtotal, discountTotal, grandTotal };
    } else if (body.totals && typeof body.totals === 'object') {
      const prevSubtotal = order.totals && typeof order.totals.subtotal === 'number' ? order.totals.subtotal : 0;
      const discountTotal = Math.max(0, Number(body.totals.discountTotal || 0));
      const grandTotal = Math.max(0, Math.round(((prevSubtotal - discountTotal)) * 100) / 100);
      update.totals = { subtotal: prevSubtotal, discountTotal, grandTotal };
    }

    const updated = await Order.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id/status — change order status and log
router.patch('/:id/status', requireRole('orders.changeStatus'), async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { newStatusCode, code, note, userId: userIdBody } = req.body || {};
    const finalCode = newStatusCode || code;
    if (!finalCode) return next(httpError(400, 'newStatusCode is required'));

    // userId from auth context (supports id or _id)
    const userId = (req.user && (req.user._id || req.user.id)) || userIdBody;
    if (!userId) return next(httpError(400, 'userId is required'));

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    // DEV fallback: update in-memory state and enqueue actions when Mongo is unavailable
    if (!mongoReady && DEV_MODE) {
      const nowIso = new Date().toISOString();
      const prev = getDevState(orderId) || {};
      const roles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : ((req.user && req.user.role) ? [req.user.role] : []);
      const fromBody = (req.body && req.body.from) || prev.status || null;

      // DEV reopen guard: require orders.reopen when reopening from closed_success
      if (fromBody === 'closed_paid' || fromBody === 'done') {
        if (!roles.includes('orders.reopen')) {
          return next(httpError(403, 'REOPEN_FORBIDDEN'));
        }
      }

      let actions = [];
      let closed = undefined;
      if (finalCode === 'closed_unpaid') {
        closed = { success: false, at: nowIso, by: String(userId) };
        actions = ['closeWithoutPayment'];
      } else if (finalCode === 'closed_paid') {
        closed = { success: true, at: nowIso, by: String(userId) };
        actions = ['payrollAccrual', 'stockIssue'];
      }
      setDevState(orderId, {
        status: finalCode,
        statusChangedAt: nowIso,
        closed,
        paymentsLocked: closed && closed.success === false ? true : !!prev.paymentsLocked,
      });

      try {
        await enqueueStatusActions({
          orderId,
          statusCode: finalCode,
          actions,
          logId: `dev-${orderId}-${Date.now()}`,
          userId,
        });
      } catch (err) {
        // ignore enqueue errors in DEV
      }

      // Record DEV in-memory status log for contracts
      const log = {
        _id: `dev-${orderId}-${Date.now()}`,
        orderId: String(orderId),
        from: fromBody || null,
        to: finalCode,
        userId: String(userId),
        note: finalCode === 'closed_paid' ? 'STATUS_ACTION_PAYROLL dev stub' : String(note || ''),
        actionsEnqueued: [],
        createdAt: nowIso,
      };
      addDevLog(orderId, log);

      // DEV: ensure timeline contains a payroll audit entry even if queue fails
      if (finalCode === 'closed_paid') {
        try {
          await OrderStatusLog.create({
            orderId: new mongoose.Types.ObjectId(orderId),
            from: prev.status || null,
            to: finalCode,
            userId: new mongoose.Types.ObjectId(userId),
            note: 'STATUS_ACTION_PAYROLL dev stub',
            actionsEnqueued: [],
          });
        } catch (e) {
          // ignore in DEV
        }
      }

      const payload = { ok: true, log };
      if (closed) payload.closed = closed;
      return res.json(payload);
    }

    if (!mongoReady) return next(httpError(503, 'MongoDB is required'));

    const roles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : ((req.user && req.user.role) ? [req.user.role] : []);
    const result = await changeOrderStatus({ orderId, newStatusCode: finalCode, userId, note, roles, user: req.user });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id — вернуть заказ по ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!Order) return res.status(500).json({ error: 'MODEL_NOT_AVAILABLE' });
    const { id } = req.params;
    const item = await Order.findById(id).lean();
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;