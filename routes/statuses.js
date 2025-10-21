const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const OrderStatus = require('../models/OrderStatus');
const { GROUPS } = require('../models/OrderStatus');
const Order = require('../models/Order');
const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
const { requireAnyRole } = require('../middleware/auth');
const TemplatesStore = require('../services/templatesStore');
const { getCache } = require('../services/ttlCache');

let NotifyTemplate; try { NotifyTemplate = require('../models/NotifyTemplate'); } catch (e) {}
let DocTemplate; try { DocTemplate = require('../models/DocTemplate'); } catch (e) {}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function validateActionsReferences(actions = []) {
  const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    if (a.type === 'notify') {
      const id = a.templateId;
      if (!id) return { type: 'notify', id: null };
      if (!mongoReady || !NotifyTemplate) {
        const tpl = TemplatesStore.getNotifyTemplate(id);
        if (!tpl) return { type: 'notify', id };
        continue;
      }
      const byId = await NotifyTemplate.findById(id).lean().catch(() => null);
      if (byId) continue;
      const byCode = await NotifyTemplate.findOne({ code: id }).lean().catch(() => null);
      if (!byCode) return { type: 'notify', id };
    } else if (a.type === 'print') {
      const id = a.docId;
      if (!id) return { type: 'print', id: null };
      if (!mongoReady || !DocTemplate) {
        const tpl = TemplatesStore.getDocTemplate(id);
        if (!tpl) return { type: 'print', id };
        continue;
      }
      const byId = await DocTemplate.findById(id).lean().catch(() => null);
      if (byId) continue;
      const byCode = await DocTemplate.findOne({ code: id }).lean().catch(() => null);
      if (!byCode) return { type: 'print', id };
    }
  }
  return null;
}

// GET /api/statuses — list grouped statuses
router.get('/', requireAnyRole(['Admin', 'settings.statuses:list']), async (req, res, next) => {
  try {
    const cache = getCache('statuses');
    const cached = cache.get('list');
    if (cached) {
      return res.json(cached);
    }

    // In DEV auth mode without Mongo connection, return in-memory defaults
    const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
    if (DEV_MODE && (mongoose.connection.readyState !== 1)) {
      const { randomUUID } = require('crypto');
      const defaults = [
        {
          _id: randomUUID(), code: 'new', name: 'Новый', color: '#4B5563', group: 'draft', order: 0, actions: [], system: true,
        },
        {
          _id: randomUUID(), code: 'in_work', name: 'В работе', color: '#2563EB', group: 'in_progress', order: 0, actions: [], system: false,
        },
        {
          _id: randomUUID(), code: 'done', name: 'Завершён', color: '#16A34A', group: 'closed_success', order: 0, actions: [], system: true,
        },
        {
          _id: randomUUID(), code: 'cancelled', name: 'Отменён', color: '#DC2626', group: 'closed_fail', order: 0, actions: [], system: true,
        },
      ];
      const byGroupDev = new Map();
      for (const s of defaults) {
        const key = s.group || '';
        if (!byGroupDev.has(key)) byGroupDev.set(key, []);
        byGroupDev.get(key).push(s);
      }
      const groupsDev = Array.from(byGroupDev.entries()).map(([group, items]) => ({ group, items }));
      groupsDev.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
      cache.set('list', groupsDev);
      return res.json(groupsDev);
    }

    const statuses = await OrderStatus.find({}).sort({ group: 1, order: 1 }).lean();
    const byGroup = new Map();
    for (const s of statuses) {
      const key = s.group || '';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(s);
    }
    const groups = Array.from(byGroup.entries()).map(([group, items]) => ({ group, items }));
    // ensure sorted by group asc
    groups.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    cache.set('list', groups);
    return res.json(groups);
  } catch (err) {
    return next(err);
  }
});

// POST /api/statuses — create
router.post('/', requireAnyRole(['Admin', 'settings.statuses:create']), async (req, res, next) => {
  try {
    const {
      code, name, color, group, order, actions, system, locationId,
    } = req.body || {};
    // optional quick checks to produce friendly errors
    if (typeof code !== 'string' || code.length < 2 || code.length > 40) {
      return next(httpError(400, 'Invalid code'));
    }
    if (!GROUPS.includes(group)) {
      return next(httpError(400, 'Invalid group'));
    }
    // references validation
    const refErr = await validateActionsReferences(Array.isArray(actions) ? actions : []);
    if (refErr) {
      return res.status(400).json({ error: 'INVALID_REFERENCE', details: refErr });
    }
    const created = await OrderStatus.create({
      code, name, color, group, order, actions: actions || [], system: !!system, locationId,
    });
    getCache('statuses').invalidateAll();
    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === 11000) {
      return next(httpError(409, 'Status code already exists'));
    }
    return next(err);
  }
});

// PUT /api/statuses/:id — update
router.put('/:id', requireAnyRole(['Admin', 'settings.statuses:update']), async (req, res, next) => {
  try {
    const patch = req.body || {};
    const cur = await OrderStatus.findById(req.params.id).lean();
    if (!cur) return next(httpError(404, 'Status not found'));
    if (cur.system) {
      const wantsCode = Object.prototype.hasOwnProperty.call(patch, 'code');
      const wantsGroup = Object.prototype.hasOwnProperty.call(patch, 'group');
      if ((wantsCode && patch.code !== cur.code) || (wantsGroup && patch.group !== cur.group)) {
        return next(httpError(400, 'System status: code/group cannot be modified'));
      }
    }
    if (patch.group && !GROUPS.includes(patch.group)) {
      return next(httpError(400, 'Invalid group'));
    }
    // references validation on update when actions provided
    if (Array.isArray(patch.actions)) {
      const refErr = await validateActionsReferences(patch.actions);
      if (refErr) {
        return res.status(400).json({ error: 'INVALID_REFERENCE', details: refErr });
      }
    }
    const updated = await OrderStatus.findByIdAndUpdate(
      req.params.id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    getCache('statuses').invalidateAll();
    return res.json(updated);
  } catch (err) {
    if (err && err.code === 11000) {
      return next(httpError(409, 'Status code already exists'));
    }
    return next(err);
  }
});

// DELETE /api/statuses/:id — delete
router.delete('/:id', requireAnyRole(['Admin', 'settings.statuses:delete']), async (req, res, next) => {
  try {
    const cur = await OrderStatus.findById(req.params.id).lean();
    if (!cur) return next(httpError(404, 'Status not found'));
    if (cur.system) return next(httpError(400, 'System status: cannot be deleted'));

    // Guard 1: prevent deletion if any orders currently have this status
    try {
      const usedByOrders = await Order.exists({ status: cur.code });
      if (usedByOrders) return next(httpError(400, 'STATUS_IN_USE'));
    } catch (e) {
      console.warn('[statuses.delete] Order.exists check failed:', e && e.message ? e.message : e);
    }

    // Guard 2 (hook): prevent deletion if any OrderType uses this status as initial
    try {
      const inTypes = await isStatusInOrderTypes(cur.code);
      if (inTypes) return next(httpError(400, 'STATUS_IN_TYPES'));
    } catch (e) {
      console.warn('[statuses.delete] isStatusInOrderTypes check failed:', e && e.message ? e.message : e);
    }

    const deleted = await OrderStatus.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return next(httpError(404, 'Status not found'));
    getCache('statuses').invalidateAll();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/statuses/reorder — batch reorder [{id,group,order}]
router.patch('/reorder', requireAnyRole(['Admin', 'settings.statuses:reorder']), async (req, res, next) => {
  try {
    const batch = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.items) ? req.body.items : null);
    if (!batch) return next(httpError(400, 'Array of items is required'));
    const errors = [];
    let updatedCount = 0;

    for (const item of batch) {
      const { id, group, order } = item || {};
      if (!id) { errors.push({ id, error: 'id is required' }); continue; }
      const cur = await OrderStatus.findById(id).lean();
      if (!cur) { errors.push({ id, error: 'Status not found' }); continue; }
      const patch = {};
      if (typeof order === 'number') patch.order = order;
      if (group !== undefined) {
        if (!GROUPS.includes(group)) { errors.push({ id, error: 'Invalid group' }); continue; }
        if (cur.system && group !== cur.group) { errors.push({ id, error: 'System status: group cannot be modified' }); continue; }
        patch.group = group;
      }
      if (Object.keys(patch).length === 0) { errors.push({ id, error: 'No changes provided' }); continue; }
      await OrderStatus.updateOne({ _id: id }, { $set: patch }, { runValidators: true });
      updatedCount += 1;
    }

    getCache('statuses').invalidateAll();
    return res.json({ ok: true, updated: updatedCount, errors });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;