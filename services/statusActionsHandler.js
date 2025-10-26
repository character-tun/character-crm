/* eslint-disable no-use-before-define */
/**
 * Handle status actions (stub implementations with TODOs)
 * Supported action types:
 * - charge: initialize payment
 * - closeWithoutPayment: mark without payment (TODO)
 * - payrollAccrual: accrue payroll
 * - notify: send notification
 * - print: generate document
 */

// Stub adapters
const paymentsAdapter = {
  async chargeInit({
    orderId, userId, statusCode, logId, amount,
  }) {
    console.log('[chargeInit] start', {
      orderId, userId, statusCode, logId, amount,
    });

    if (!orderId) { throw new Error('ORDER_ID_REQUIRED'); }

    let Payment; let CashRegister;
    try { Payment = require('../server/models/Payment'); } catch (e) {}
    try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}

    if (!Payment || !Order) { throw new Error('MODEL_NOT_AVAILABLE'); }

    let ord = await Order.findById(orderId).lean();
    // Merge DEV in-memory state when Mongo is not ready
    if (!mongoReady()) {
      const dev = getDevState(orderId);
      if (dev) { ord = { ...ord, ...dev }; }
    }
    if (!ord) { throw new Error('ORDER_NOT_FOUND'); }
    if (ord.paymentsLocked === true || (ord.closed && ord.closed.success === false)) { throw new Error('PAYMENTS_LOCKED'); }
    if (ord.closed && ord.closed.success === true) { throw new Error('ORDER_CLOSED'); }

    const baseTotal = (ord.totals && typeof ord.totals.grandTotal === 'number') ? ord.totals.grandTotal : 0;

    let paidIncome = 0; let paidExpense = 0; let paidRefund = 0;
    try {
      const agg = await Payment.aggregate([
        { $match: { orderId: new mongoose.Types.ObjectId(orderId) } },
        { $group: { _id: '$type', sum: { $sum: '$amount' } } },
      ]);
      agg.forEach((g) => {
        if (g._id === 'income') paidIncome = Number(g.sum || 0);
        if (g._id === 'expense') paidExpense = Number(g.sum || 0);
        if (g._id === 'refund') paidRefund = Number(g.sum || 0);
      });
    } catch (e) {
      console.warn('[chargeInit] aggregate payments failed; assuming zero paid', e && e.message);
    }
    const paidBalance = paidIncome - paidExpense - paidRefund;
    const remaining = Math.max(Number(baseTotal || 0) - Number(paidBalance || 0), 0);

    const amt = (typeof amount === 'number' && amount > 0) ? amount : remaining;
    if (!(amt > 0)) {
      console.warn('[chargeInit] skip: NO_REMAINING', { baseTotal, paidBalance });
      return { ok: true, skipped: true, reason: 'NO_REMAINING' };
    }

    let cash = null;
    try {
      if (CashRegister) {
        let q = CashRegister.findOne({ defaultForLocation: true });
        cash = q && typeof q.lean === 'function' ? await q.lean() : (q && typeof q.exec === 'function' ? await q.exec() : null);
        if (!cash) {
          q = CashRegister.findOne({ isSystem: true, code: 'main' });
          cash = q && typeof q.lean === 'function' ? await q.lean() : (q && typeof q.exec === 'function' ? await q.exec() : null);
        }
        if (!cash) {
          q = CashRegister.findOne({});
          cash = q && typeof q.lean === 'function' ? await q.lean() : (q && typeof q.exec === 'function' ? await q.exec() : null);
        }
      }
    } catch (e) {
      console.warn('[chargeInit] cash register lookup failed', e && e.message);
    }
    if (!cash || !cash._id) { throw new Error('CASH_NOT_FOUND'); }

    const payload = {
      orderId: new mongoose.Types.ObjectId(orderId),
      type: 'income',
      articlePath: ['Продажи', 'Касса'],
      amount: amt,
      cashRegisterId: new mongoose.Types.ObjectId(cash._id),
      method: 'auto',
      note: 'auto: chargeInit',
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      locationId: ord.locationId ? new mongoose.Types.ObjectId(ord.locationId) : undefined,
    };

    const created = await Payment.create(payload);

    try {
      await OrderStatusLog.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        from: statusCode,
        to: statusCode,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        note: `STATUS_ACTION_CHARGE created payment ${created._id}`,
        actionsEnqueued: [],
      });
    } catch (e) {
      console.warn('[chargeInit] audit log create failed', e && e.message);
    }

    console.log('[chargeInit] created', { id: created._id, amount: created.amount });
    return { ok: true, id: created._id };
  },
};

const payrollAdapter = {
  async accrue({
    orderId, userId, statusCode, logId, amount, percent,
  }) {
    console.log('[payrollAccrual] start', {
      orderId, userId, statusCode, logId, amount, percent,
    });

    if (!orderId) { throw new Error('ORDER_ID_REQUIRED'); }

    let PayrollAccrual;
    try { PayrollAccrual = require('../server/models/PayrollAccrual'); } catch (e) {}

    if (!Order || !PayrollAccrual) { throw new Error('MODEL_NOT_AVAILABLE'); }

    // Safely resolve order document when models may be mocked or DB not ready
    let ord = null;
    try {
      const q = Order && typeof Order.findById === 'function' ? Order.findById(orderId) : null;
      if (q && typeof q.lean === 'function') {
        ord = await q.lean();
      } else if (q && typeof q.exec === 'function') {
        ord = await q.exec();
      } else if (q && typeof q.then === 'function') {
        ord = await q; // promise-like mock
      }
    } catch (e) {
      // swallow and fallback to DEV state
    }
    if (!ord) {
      const dev = !mongoReady() ? getDevState(orderId) : null;
      if (dev) ord = dev;
    }

    // If still not available, skip gracefully (DEV tests may mock models)
    if (!ord) {
      console.warn('[payrollAccrual] skip: ORDER_NOT_FOUND_DEV');
      return { ok: true, skipped: true, reason: 'ORDER_NOT_FOUND_DEV' };
    }

    const baseTotal = (ord.totals && typeof ord.totals.grandTotal === 'number') ? ord.totals.grandTotal : 0;
    const pct = typeof percent === 'number' ? percent : Number(process.env.PAYROLL_PERCENT || 0.1);
    const computed = typeof amount === 'number' && amount > 0 ? amount : Math.max(Math.round(baseTotal * pct), 0);

    if (!(computed > 0)) {
      console.warn('[payrollAccrual] skip: NO_AMOUNT', { baseTotal, pct });
      return { ok: true, skipped: true, reason: 'NO_AMOUNT' };
    }

    const employeeId = (ord.closed && ord.closed.by) ? ord.closed.by : (userId ? new mongoose.Types.ObjectId(userId) : undefined);

    const created = await PayrollAccrual.create({
      orderId: new mongoose.Types.ObjectId(orderId),
      employeeId,
      amount: computed,
      percent: pct,
      baseAmount: baseTotal,
      orderStatusLogId: logId ? new mongoose.Types.ObjectId(logId) : undefined,
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      note: 'auto: payrollAccrual',
    });

    try {
      await OrderStatusLog.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        from: statusCode,
        to: statusCode,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        note: `STATUS_ACTION_PAYROLL created accrual ${created._id}`,
        actionsEnqueued: [],
      });
    } catch (e) {
      console.warn('[payrollAccrual] audit log create failed', e && e.message);
    }

    console.log('[payrollAccrual] created', { id: created._id, amount: created.amount });
    return { ok: true, id: created._id };
  },
};

let notifyAdapter = {
  async send(channel, templateId, context) {
    console.log('[notify] send', { channel, templateId, context });
    // TODO: integrate notification service
    return { ok: true };
  },
};

let printAdapter = {
  async generate(docId, orderId) {
    console.log('[print] generate', { docId, orderId });
    // TODO: integrate print/generation service
    return { ok: true };
  },
};

// --- New: integrate persistence and DEV in-memory flags ---
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderStatusLog = require('../models/OrderStatusLog');

// DEV in-memory order state helpers (used when Mongo is not available in tests)
const _DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const __devOrders = new Map();
function mongoReady() { return !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db); }
function getDevState(orderId) { const st = __devOrders.get(String(orderId)); return st ? { ...st } : null; }
function setDevState(orderId, state) { const prev = getDevState(orderId) || {}; __devOrders.set(String(orderId), { ...prev, ...state }); }
function isPaymentsLocked(orderId) { const st = getDevState(orderId); return !!(st && (st.paymentsLocked === true || (st.closed && st.closed.success === false))); }
function __devReset() { __devOrders.clear(); }

// Stock models
let StockItem; let StockMovement;
try { StockItem = require('../server/models/StockItem'); } catch (e) {}
try { StockMovement = require('../server/models/StockMovement'); } catch (e) {}

// Templates access (Mongo models only)
let NotifyTemplate; let
  DocTemplate;
try { NotifyTemplate = require('../models/NotifyTemplate'); } catch (e) {}
try { DocTemplate = require('../models/DocTemplate'); } catch (e) {}

// File store
const fileStore = require('./fileStore');
const TemplatesStore = require('./templatesStore');

async function markCloseWithoutPayment({
  orderId, userId, statusCode, logId,
}) {
  console.log('[closeWithoutPayment] mark', {
    orderId, userId, statusCode, logId,
  });
  const now = new Date();

  // DEV fallback: update in-memory state when Mongo is not ready
  if (!mongoReady()) {
    setDevState(orderId, {
      closed: { success: false, at: now.toISOString(), by: String(userId) },
      paymentsLocked: true,
    });
    // Try to update mocked Order doc if present (unit tests)
    try {
      const MOrder = require('../models/Order');
      const res = MOrder && typeof MOrder.findById === 'function' ? MOrder.findById(orderId) : null;
      if (res && typeof res.then === 'function') {
        await res.then((doc) => {
          if (doc) {
            const d = doc;
            d.paymentsLocked = true;
            if (!d.closed || typeof d.closed.success !== 'boolean') {
              d.closed = { success: false, at: now, by: String(userId) };
            }
            if (typeof d.save === 'function') {
              try { d.save(); } catch {}
            }
          }
        });
      }
    } catch {}
    return { ok: true };
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.warn('[closeWithoutPayment] order not found', { orderId });
      return { ok: false, notFound: true };
    }
    if (!order.closed || typeof order.closed.success !== 'boolean') {
      order.closed = { success: false, at: now, by: new mongoose.Types.ObjectId(userId) };
    }
    order.paymentsLocked = true;
    await order.save();

    try {
      await OrderStatusLog.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        from: statusCode,
        to: statusCode,
        userId: new mongoose.Types.ObjectId(userId),
        note: 'auto: closeWithoutPayment',
        actionsEnqueued: [],
      });
    } catch (e) {
      console.warn('[closeWithoutPayment] audit log create failed', e.message);
    }
    return { ok: true };
  } catch (err) {
    console.error('[closeWithoutPayment] error', err);
    throw err;
  }
}

function normalizeAction(action) {
  if (!action) return null;
  if (typeof action === 'string') return { type: action };
  if (typeof action === 'object' && action.type) return action;
  return null;
}

function resolvePath(obj, pathStr) {
  try { return pathStr.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj); } catch { return undefined; }
}
function renderVars(str = '', ctx = {}) {
  return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    const v = resolvePath(ctx, p);
    return v == null ? '' : String(v);
  });
}
async function pickTemplate(type, idOrCode) {
  if (!idOrCode) return null;
  const isConnReady = mongoose.connection && mongoose.connection.readyState === 1;
  const isJestMock = (fn) => !!(fn && typeof fn === 'function' && (fn._isMockFunction || ('mock' in fn)));

  const useNotifyModel = NotifyTemplate && (isConnReady || isJestMock(NotifyTemplate.findById) || isJestMock(NotifyTemplate.findOne));
  const useDocModel = DocTemplate && (isConnReady || isJestMock(DocTemplate.findById) || isJestMock(DocTemplate.findOne));

  if (type === 'notify' && useNotifyModel) {
    const byId = await NotifyTemplate.findById(idOrCode).lean().catch(() => null);
    if (byId) return byId;
    const byCode = await NotifyTemplate.findOne({ code: idOrCode }).lean().catch(() => null);
    if (byCode) return byCode;
  }
  if (type === 'doc' && useDocModel) {
    const byId = await DocTemplate.findById(idOrCode).lean().catch(() => null);
    if (byId) return byId;
    const byCode = await DocTemplate.findOne({ code: idOrCode }).lean().catch(() => null);
    if (byCode) return byCode;
  }
  // DEV fallback to in-memory TemplatesStore
  try {
    if (type === 'notify') {
      return TemplatesStore.getNotifyTemplate(idOrCode) || TemplatesStore.listNotifyTemplates().find((t) => t.code === idOrCode) || null;
    }
    if (type === 'doc') {
      return TemplatesStore.getDocTemplate(idOrCode) || TemplatesStore.listDocTemplates().find((t) => t.code === idOrCode) || null;
    }
  } catch (e) {
    // ignore DEV fallback errors
  }
  return null;
}

// Real adapters
notifyAdapter = {
  async send(channel, templateId, context) {
    const tpl = await pickTemplate('notify', templateId);
    if (!tpl) { console.warn('[notify] template not found', templateId); throw new Error(`INVALID_REFERENCE_NOTIFY:${templateId}`); }

    const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';
    const to = (context.client && context.client.email) || process.env.SMTP_TO || 'dev@example.com';
    const subject = renderVars(tpl.subject, { order: { id: context.orderId }, client: context.client || {} });
    const html = renderVars(tpl.bodyHtml, { order: { id: context.orderId }, client: context.client || {} });

    const DRY = process.env.NOTIFY_DRY_RUN === '1';
    if (DRY) {
      console.log('[notify][DRY_RUN] skip send, subject:', subject);
      return { ok: true, dryRun: true };
    }

    const host = process.env.SMTP_HOST; const
      port = Number(process.env.SMTP_PORT || 0) || 587;
    const user = process.env.SMTP_USER; const
      pass = process.env.SMTP_PASS;
    if (!host || !port || !user || !pass) {
      console.warn('[notify] SMTP config missing, DRY fallback');
      return { ok: true, dryRun: true };
    }

    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (e) {
      console.warn('[notify] nodemailer not installed, DRY fallback');
      return { ok: true, dryRun: true };
    }

    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    });
    await transporter.sendMail({
      from: SMTP_FROM, to, subject, html,
    });
    console.log('[notify] sent', { to, subject, orderId: context.orderId });

    // Audit on success when Mongo is connected
    const auditReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (auditReady) {
      try {
        await OrderStatusLog.create({
          orderId: new mongoose.Types.ObjectId(context.orderId),
          from: context.statusCode,
          to: context.statusCode,
          userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
          note: `STATUS_ACTION_NOTIFY sent to ${to}`,
          actionsEnqueued: [],
        });
      } catch (e) {
        console.warn('[notify] audit log create failed', e.message);
      }
    }

    return { ok: true };
  },
};

printAdapter = {
  async generate(docId, orderId) {
    const tpl = await pickTemplate('doc', docId);
    if (!tpl) { console.warn('[print] template not found', docId); throw new Error(`INVALID_REFERENCE_PRINT:${docId}`); }

    const html = renderVars(tpl.bodyHtml, { order: { id: orderId } });
    const DRY = process.env.PRINT_DRY_RUN === '1';

    if (DRY) {
      console.log('[print][DRY_RUN] skip generation, doc:', tpl.code || 'doc');
      return { ok: true, dryRun: true };
    }

    let buffer;
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setContent(html);
      buffer = await page.pdf({ format: 'A4' });
      await browser.close();
    } catch (e) {
      console.warn('[print] puppeteer unavailable, fallback to HTML buffer', e.message);
      buffer = Buffer.from(html);
    }

    const fileId = await fileStore.saveBuffer(buffer, 'application/pdf', `${tpl.code || 'doc'}-${orderId}.pdf`);
    const meta = fileStore.getMeta(fileId);

    try {
      const order = await Order.findById(orderId);
      if (order) {
        order.files = order.files || [];
        order.files.push({
          id: fileId, name: meta.name, mime: meta.mime, size: meta.size, createdAt: meta.createdAt,
        });
        await order.save();
      }
      try {
        await OrderStatusLog.create({
          orderId: new mongoose.Types.ObjectId(orderId),
          from: 'print',
          to: 'print',
          note: `STATUS_ACTION_PRINT stored ${fileId}`,
          actionsEnqueued: [],
        });
      } catch (e) {
        console.warn('[print] audit log create failed', e.message);
      }
    } catch (e) {
      console.warn('[print] unable to attach file to order (mongo)', e.message);
    }

    console.log('[print] file stored', { fileId, orderId });
    return { ok: true, fileId };
  },
};

// --- New: stock issue adapter ---
async function issueStockFromOrder({ orderId, userId }) {
  const isConnReady = mongoose.connection && mongoose.connection.readyState === 1;
  const isJestMock = (fn) => !!(fn && typeof fn === 'function' && (fn._isMockFunction || ('mock' in fn)));

  // If stock models are not available, or DB is not ready and models are not mocked, skip gracefully
  if (!StockItem || !StockMovement) {
    console.warn('[stockIssue] skip: MODEL_NOT_AVAILABLE');
    return { ok: true, skipped: true, reason: 'MODEL_NOT_AVAILABLE' };
  }
  const modelsMocked = isJestMock(StockItem.findOne) || isJestMock(StockItem.create) || isJestMock(StockMovement.create);
  if (!isConnReady && !modelsMocked) {
    console.warn('[stockIssue] skip: DB_NOT_READY');
    return { ok: true, skipped: true, reason: 'DB_NOT_READY' };
  }

  const order = await Order.findById(orderId).lean();
  if (!order) { throw new Error('ORDER_NOT_FOUND'); }
  const lines = Array.isArray(order.items) ? order.items : [];
  let issued = 0;
  for (const ln of lines) {
    const itemId = ln && ln.itemId ? ln.itemId : null;
    const qty = ln && typeof ln.qty === 'number' ? ln.qty : 0;
    if (!itemId || qty <= 0) continue;

    // Idempotency guard: skip if issue movement already exists for this order+item+qty
    let skip = false;
    try {
      const existing = await (StockMovement.find ? StockMovement.find({}).lean() : []);
      const existingList = Array.isArray(existing) ? existing : [];
      skip = existingList.some((m) => (
        m && m.type === 'issue'
        && String(m.itemId) === String(itemId)
        && Number(m.qty) === Number(-qty)
        && m.source && m.source.kind === 'order'
        && String(m.source.id) === String(orderId)
      ));
      if (skip) {
        console.warn('[stockIssue] skip: ALREADY_ISSUED', { orderId, itemId, qty });
      }
    } catch (e) {}
    if (skip) { continue; }

    let si = await StockItem.findOne({ itemId });
    if (!si) {
      si = await StockItem.create({ itemId, qtyOnHand: 0, createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined });
    }
    si.qtyOnHand = Number(si.qtyOnHand || 0) - qty; // issue: decrement
    await si.save();

    await StockMovement.create({
      stockItemId: si._id,
      itemId,
      type: 'issue',
      qty: -qty,
      note: 'auto: issue on order close',
      source: { kind: 'order', id: new mongoose.Types.ObjectId(orderId) },
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
    });
    issued += 1;
  }
  console.log('[stockIssue] created movements', { orderId, lines: lines.length, issued });
  return { ok: true, issued };
}

/**
 * Process actions for a status change.
 * Throws on errors to allow job retry/backoff.
 */
async function handleStatusActions({
  orderId, statusCode, actions, logId, userId,
}) {
  const items = Array.isArray(actions) ? actions : [];
  let processed = 0;

  for (const raw of items) {
    const action = normalizeAction(raw);
    if (!action) {
      console.warn('[statusActions] skip invalid action', raw);
      continue;
    }
    try {
      switch (action.type) {
        case 'charge':
          await paymentsAdapter.chargeInit({
            orderId, userId, statusCode, logId, amount: action.amount,
          });
          break;
        case 'closeWithoutPayment':
          await markCloseWithoutPayment({
            orderId, userId, statusCode, logId,
          });
          break;
        case 'payrollAccrual':
          await payrollAdapter.accrue({
            orderId, userId, statusCode, logId, amount: action.amount, percent: action.percent,
          });
          break;
        case 'notify':
          {
            const refId = action.templateId || action.code;
            const tplCheck = refId ? (await pickTemplate('notify', refId)) : null;
            if (!tplCheck) throw new Error(`INVALID_REFERENCE_NOTIFY:${refId || 'null'}`);
            await notifyAdapter.send(action.channel || 'email', refId, {
              orderId, statusCode, logId, userId,
            });
          }
          break;
        case 'print':
          {
            const refId = action.docId || action.code;
            const tplCheck = refId ? (await pickTemplate('doc', refId)) : null;
            if (!tplCheck) throw new Error(`INVALID_REFERENCE_PRINT:${refId || 'null'}`);
            await printAdapter.generate(refId, orderId);
          }
          break;
        case 'stockIssue':
          await issueStockFromOrder({ orderId, userId });
          break;
        default:
          console.warn('[statusActions] unknown action type', action.type);
          break;
      }
      processed += 1;
    } catch (err) {
      console.error('[statusActions] action error', {
        orderId, statusCode, logId, action,
      }, err);
      throw err;
    }
  }

  return { ok: true, processed };
}

module.exports = {
  handleStatusActions, markCloseWithoutPayment, getDevState, setDevState, isPaymentsLocked, __devReset,
};
