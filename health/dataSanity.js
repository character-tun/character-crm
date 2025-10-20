#!/usr/bin/env node
/*
  health/dataSanity.js
  Проверяет инварианты в БД для коллекций OrderStatus, Orders и логи OrderStatusLog.
  Выводит JSON-отчёт со списком проблемных ID. Завершает процесс с кодом 0.
*/

require('dotenv').config();
const mongoose = require('mongoose');

const OrderStatus = require('../models/OrderStatus');
const Order = require('../models/Order');
const OrderStatusLog = require('../models/OrderStatusLog');
const NotifyTemplate = require('../models/NotifyTemplate');
const DocTemplate = require('../models/DocTemplate');

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
    summary: {
      statusesCount: 0,
      ordersCount: 0,
      logsCount: 0,
    },
    problems: {
      orderStatus: {
        duplicateCodes: [], // { code, ids: [] }
        invalidGroups: [], // statusIds
        orphanActions: [], // { statusId, index, type, ref: 'templateId'|'docId', refId }
        invalidNotifyActions: [], // { statusId, index, error }
      },
      orders: {
        unknownStatus: [], // orderIds
        closedFailedPaymentsUnlocked: [], // orderIds
        missingStatusChangedAt: [], // orderIds
      },
      logs: {
        invalidTransitions: [], // { orderId, prevLogId, currentLogId, prevTo, currentFrom }
        invalidStatusCodes: [], // { logId, field: 'from'|'to', value }
        duplicateLogs: [], // { orderId, createdAt, count }
        actionDuplicates: [], // { logId, type }
      },
    },
    info: {
      limitations: [
        'Нет модели Payments в БД: проверка незавершённых платежей при closed.success=true пропущена.',
      ],
    },
    when: new Date().toISOString(),
  };

  if (!mongoConnected) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }

  try {
    // Collect refs
    const statuses = await OrderStatus.find({}).lean();
    const orders = await Order.find({}).lean();
    const logs = await OrderStatusLog.find({}).lean();

    report.summary.statusesCount = statuses.length;
    report.summary.ordersCount = orders.length;
    report.summary.logsCount = logs.length;

    const allowedGroups = OrderStatus.GROUPS || ['draft', 'in_progress', 'closed_success', 'closed_fail'];
    const statusCodes = new Set((statuses || []).map((s) => s.code).filter(Boolean));

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

    // 2) Orders checks
    for (const o of orders) {
      const st = o.status || null;
      if (!st || !statusCodes.has(st)) report.problems.orders.unknownStatus.push(o._id || o.id);
      if (!o.statusChangedAt) report.problems.orders.missingStatusChangedAt.push(o._id || o.id);
      // closed.success=false => paymentsLocked=true
      const closedFail = !!(o.closed && o.closed.success === false);
      if (closedFail && o.paymentsLocked !== true) report.problems.orders.closedFailedPaymentsUnlocked.push(o._id || o.id);
      // closed.success=true => нет незавершённых платежей — недоступно без Payment модели
    }

    // 3) Logs checks
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

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    // На случай непредвиденной ошибки: всё равно выдать отчёт и завершить 0
    report.error = err && err.message ? err.message : String(err);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
})();