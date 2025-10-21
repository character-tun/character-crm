#!/usr/bin/env node
/*
  health/dataSanity.js
  Проверяет инварианты в БД для коллекций OrderStatus, Orders, OrderStatusLog и OrderTypes.
  Выводит JSON-отчёт со списком проблемных ID. Завершает процесс с кодом 0.
*/

require('dotenv').config();
const mongoose = require('mongoose');

const OrderStatus = require('../models/OrderStatus');
const Order = require('../models/Order');
const OrderStatusLog = require('../models/OrderStatusLog');
const NotifyTemplate = require('../models/NotifyTemplate');
const DocTemplate = require('../models/DocTemplate');
const OrderType = require('../server/models/OrderType');
// NEW: include FieldSchema model for health checks
const FieldSchema = require('../server/models/FieldSchema');

const asObjectId = (s) => {
  try {
    if (!s || typeof s !== 'string') return null;
    if (!/^[a-fA-F0-9]{24}$/.test(s)) return null;
    return new mongoose.Types.ObjectId(s);
  } catch (_) {
    return null;
  }
};

(async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/character-crm';
  let mongoConnected = false;
  try {
    const conn = await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    mongoConnected = conn && conn.connection && conn.connection.readyState === 1;
  } catch (err) {
    mongoConnected = false;
  }

  const report = {
    mongoConnected,
    ok: false,
    summary: {
      statusesCount: 0,
      ordersCount: 0,
      logsCount: 0,
      orderTypesCount: 0,
      // NEW: count of FieldSchemas
      fieldSchemasCount: 0,
      problemsTotal: 0,
    },
    problems: {
      orderStatus: {
        duplicateCodes: [], // { code, ids: [] }
        invalidGroups: [], // statusIds
        orphanActions: [], // { statusId, index, type, ref: 'templateId'|'docId', refId }
        invalidNotifyActions: [], // { statusId, index, error }
      },
      orderTypes: {
        invalidStartStatus: [], // orderTypeIds
        systemCodeUnexpected: [], // { id, code }
      },
      orders: {
        unknownStatus: [], // orderIds
        unknownOrderTypeId: [], // orderIds
        closedFailedPaymentsUnlocked: [], // orderIds
        missingStatusChangedAt: [], // orderIds
      },
      logs: {
        invalidTransitions: [], // { orderId, prevLogId, currentLogId, prevTo, currentFrom }
        invalidStatusCodes: [], // { logId, field: 'from'|'to', value }
        duplicateLogs: [], // { orderId, createdAt, count }
        actionDuplicates: [], // { logId, type }
      },
      // NEW: FieldSchemas health checks
      fieldSchemas: {
        multiActiveForPair: [], // { scope, name, ids }
        noActiveForPair: [], // { scope, name, ids }
        duplicateVersionNumbers: [], // { scope, name, version, ids }
        invalidVersionNumbers: [], // { id, version }
        invalidOptions: [], // { id, index, code, type }
      },
    },
    info: {
      limitations: [
        'Нет модели Payments в БД: проверка незавершённых платежей при closed.success=true пропущена.',
        'Иммутабельность code системных типов проверяется эвристикой: код должен принадлежать зарезервированному набору (по умолчанию [\'default\']).',
      ],
      reservedSystemCodes: ['default'],
    },
    when: new Date().toISOString(),
  };

  if (!mongoConnected) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }

  try {
    // Collect refs (added FieldSchema)
    const [statuses, orders, logs, orderTypes, fieldSchemas] = await Promise.all([
      OrderStatus.find({}).lean(),
      Order.find({}).lean(),
      OrderStatusLog.find({}).lean(),
      OrderType.find({}).lean(),
      FieldSchema.find({}).lean(),
    ]);

    report.summary.statusesCount = statuses.length;
    report.summary.ordersCount = orders.length;
    report.summary.logsCount = logs.length;
    report.summary.orderTypesCount = orderTypes.length;
    // NEW: set FieldSchemas count
    report.summary.fieldSchemasCount = fieldSchemas.length;

    const allowedGroups = OrderStatus.GROUPS || ['draft', 'in_progress', 'closed_success', 'closed_fail'];
    const statusCodes = new Set((statuses || []).map((s) => s.code).filter(Boolean));
    const orderTypeIds = new Set((orderTypes || []).map((t) => String(t._id)));

    // 1) OrderStatus checks
    const codeMap = new Map();
    for (const s of statuses) {
      if (!codeMap.has(s.code)) codeMap.set(s.code, []);
      codeMap.get(s.code).push(s._id);
      if (!allowedGroups.includes(s.group)) report.problems.orderStatus.invalidGroups.push(s._id);

      // actions: orphan refs
      const actions = Array.isArray(s.actions) ? s.actions : [];
      for (let i = 0; i < actions.length; i += 1) {
        const a = actions[i] || {};
        // notify requires templateId and channel
        if (a.type === 'notify') {
          const hasTpl = !!a.templateId;
          const hasChannel = !!a.channel;
          if (!hasTpl || !hasChannel) {
            report.problems.orderStatus.invalidNotifyActions.push({ statusId: s._id, index: i, error: !hasTpl ? 'missing templateId' : 'missing channel' });
          }
        }
        if (a.templateId) {
          const oid = asObjectId(a.templateId);
          const template = oid ? await NotifyTemplate.findOne({ _id: oid }).lean() : await NotifyTemplate.findOne({ _id: a.templateId }).lean();
          if (!template) {
            report.problems.orderStatus.orphanActions.push({ statusId: s._id, index: i, type: a.type, ref: 'templateId', refId: a.templateId });
          }
        }
        if (a.docId) {
          const oid = asObjectId(a.docId);
          const doc = oid ? await DocTemplate.findOne({ _id: oid }).lean() : await DocTemplate.findOne({ _id: a.docId }).lean();
          if (!doc) {
            report.problems.orderStatus.orphanActions.push({ statusId: s._id, index: i, type: a.type, ref: 'docId', refId: a.docId });
          }
        }
      }
    }
    for (const [code, ids] of codeMap.entries()) {
      if ((ids || []).length > 1) report.problems.orderStatus.duplicateCodes.push({ code, ids });
    }

    // 2) OrderTypes checks
    const reservedSystemCodes = (report.info && report.info.reservedSystemCodes) || ['default'];
    for (const t of orderTypes) {
      // startStatusId ∈ allowedStatuses (если start задан)
      if (t && t.startStatusId) {
        const allowed = Array.isArray(t.allowedStatuses) ? t.allowedStatuses : [];
        const included = allowed.some((id) => (id && t.startStatusId) && String(id) === String(t.startStatusId));
        if (!included) report.problems.orderTypes.invalidStartStatus.push(t._id);
      }
      // у системных типов code неизменяем: эвристика — код должен быть из зарезервированного списка
      if (t && t.isSystem === true) {
        const code = (t.code || '').toString().trim().toLowerCase();
        if (!reservedSystemCodes.includes(code)) {
          report.problems.orderTypes.systemCodeUnexpected.push({ id: t._id, code: t.code });
        }
      }
    }

    // 3) Orders checks
    for (const o of orders) {
      const st = o.status || null;
      if (!st || !statusCodes.has(st)) report.problems.orders.unknownStatus.push(o._id || o.id);
      if (!o.statusChangedAt) report.problems.orders.missingStatusChangedAt.push(o._id || o.id);
      // orderTypeId должен существовать
      const typeId = o.orderTypeId ? String(o.orderTypeId) : null;
      if (!typeId || !orderTypeIds.has(typeId)) report.problems.orders.unknownOrderTypeId.push(o._id || o.id);
      // closed.success=false => paymentsLocked=true
      const closedFail = !!(o.closed && o.closed.success === false);
      if (closedFail && o.paymentsLocked !== true) report.problems.orders.closedFailedPaymentsUnlocked.push(o._id || o.id);
    }

    // 4) Logs checks
    // index by orderId
    const logsByOrder = new Map();
    for (const lg of logs) {
      const key = String(lg.orderId);
      if (!logsByOrder.has(key)) logsByOrder.set(key, []);
      logsByOrder.get(key).push(lg);
      // status codes validity
      if (lg.from && !statusCodes.has(lg.from)) report.problems.logs.invalidStatusCodes.push({ logId: lg._id, field: 'from', value: lg.from });
      if (lg.to && !statusCodes.has(lg.to)) report.problems.logs.invalidStatusCodes.push({ logId: lg._id, field: 'to', value: lg.to });
      // actions duplicates by type
      const types = new Set();
      for (const a of (lg.actionsEnqueued || [])) {
        const t = a && a.type;
        if (!t) continue;
        if (types.has(t)) report.problems.logs.actionDuplicates.push({ logId: lg._id, type: t });
        types.add(t);
      }
    }

    for (const [orderId, arr] of logsByOrder.entries()) {
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      // duplicates by same createdAt timestamp
      const byTs = new Map();
      for (const lg of arr) {
        const ts = new Date(lg.createdAt).toISOString();
        byTs.set(ts, (byTs.get(ts) || 0) + 1);
      }
      for (const [ts, count] of byTs.entries()) {
        if (count > 1) report.problems.logs.duplicateLogs.push({ orderId, createdAt: ts, count });
      }
      // sequence validity: prev.to === cur.from
      for (let i = 1; i < arr.length; i += 1) {
        const prev = arr[i - 1];
        const cur = arr[i];
        const prevTo = prev && prev.to;
        const curFrom = cur && cur.from;
        if (prevTo !== curFrom) {
          report.problems.logs.invalidTransitions.push({ orderId, prevLogId: prev._id, currentLogId: cur._id, prevTo, currentFrom: curFrom });
        }
      }
    }

    // 5) FieldSchemas checks
    const byPair = new Map();
    for (const fs of fieldSchemas) {
      const scope = (fs.scope || '').toString().trim();
      const name = (fs.name || '').toString().trim();
      const key = `${scope}||${name}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(fs);
      // invalid version numbers
      if (typeof fs.version !== 'number' || !Number.isInteger(fs.version) || fs.version < 1) {
        report.problems.fieldSchemas.invalidVersionNumbers.push({ id: fs._id, version: fs.version });
      }
      // invalid options for list/multilist
      const arr = Array.isArray(fs.fields) ? fs.fields : [];
      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i] || {};
        if (f.type === 'list' || f.type === 'multilist') {
          if (!Array.isArray(f.options) || f.options.length === 0) {
            report.problems.fieldSchemas.invalidOptions.push({ id: fs._id, index: i, code: f.code, type: f.type });
          }
        }
      }
    }
    for (const [key, items] of byPair.entries()) {
      const [scope, name] = key.split('||');
      const active = items.filter((x) => x.isActive);
      if (active.length > 1) {
        report.problems.fieldSchemas.multiActiveForPair.push({ scope, name, ids: active.map((x) => x._id) });
      }
      if (active.length === 0 && items.length > 0) {
        report.problems.fieldSchemas.noActiveForPair.push({ scope, name, ids: items.map((x) => x._id) });
      }
      // duplicate version numbers within pair
      const byVer = new Map();
      for (const it of items) {
        const v = it.version;
        const arr = byVer.get(v) || [];
        arr.push(it._id);
        byVer.set(v, arr);
      }
      for (const [v, ids] of byVer.entries()) {
        if (ids.length > 1) {
          report.problems.fieldSchemas.duplicateVersionNumbers.push({ scope, name, version: v, ids });
        }
      }
    }

    // Aggregate OK flag and total problems
    const counts = [
      report.problems.orderStatus.duplicateCodes.length,
      report.problems.orderStatus.invalidGroups.length,
      report.problems.orderStatus.orphanActions.length,
      report.problems.orderStatus.invalidNotifyActions.length,
      report.problems.orderTypes.invalidStartStatus.length,
      report.problems.orderTypes.systemCodeUnexpected.length,
      report.problems.orders.unknownStatus.length,
      report.problems.orders.unknownOrderTypeId.length,
      report.problems.orders.closedFailedPaymentsUnlocked.length,
      report.problems.orders.missingStatusChangedAt.length,
      report.problems.logs.invalidTransitions.length,
      report.problems.logs.invalidStatusCodes.length,
      report.problems.logs.duplicateLogs.length,
      report.problems.logs.actionDuplicates.length,
      // NEW: include FieldSchemas problems
      report.problems.fieldSchemas.multiActiveForPair.length,
      report.problems.fieldSchemas.noActiveForPair.length,
      report.problems.fieldSchemas.duplicateVersionNumbers.length,
      report.problems.fieldSchemas.invalidVersionNumbers.length,
      report.problems.fieldSchemas.invalidOptions.length,
    ];
    const problemsTotal = counts.reduce((a, b) => a + b, 0);
    report.summary.problemsTotal = problemsTotal;
    report.ok = problemsTotal === 0;

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    // На случай непредвиденной ошибки: всё равно выдать отчёт и завершить 0
    report.error = err && err.message ? err.message : String(err);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
})();