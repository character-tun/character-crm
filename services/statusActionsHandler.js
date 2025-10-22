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

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;

    // DEV branch: no Mongo, use in-memory payments store
    if (!mongoReady) {
      // Guard by DEV flags
      const st = getDevState(orderId);
      const locked = !!(st && (st.paymentsLocked || (st.closed && st.closed.success === false)));
      if (locked) throw new Error('PAYMENTS_LOCKED');
      if (st && st.closed && st.closed.success === true) throw new Error('ORDER_CLOSED');

      // Require explicit amount in DEV since we cannot compute order totals here
      const amt = typeof amount === 'number' && amount > 0 ? amount : 0;
      if (!(amt > 0)) {
        console.warn('[chargeInit][DEV] skip: NO_AMOUNT');
        return { ok: true, skipped: true, reason: 'NO_AMOUNT' };
      }

      // Lazy import to avoid circulars in unit tests
      const devPaymentsStore = require('./devPaymentsStore');
      const nextId = devPaymentsStore.nextId();
      const item = {
        _id: nextId,
        orderId,
        type: 'income',
        articlePath: ['Продажи', 'Касса'],
        amount: amt,
        // cashRegisterId intentionally omitted in DEV fallback
        method: 'auto',
        note: 'auto: chargeInit',
        locationId: undefined,
        createdBy: userId || undefined,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      devPaymentsStore.pushItem(item);
      console.log('[chargeInit][DEV] created', { id: item._id, amount: item.amount });
      return { ok: true, id: item._id };
    }

    // Mongo branch: compute remaining and persist via Payment model
    let Payment; let CashRegister;
    try { Payment = require('../server/models/Payment'); } catch (e) {}
    try { CashRegister = require('../server/models/CashRegister'); } catch (e) {}

    // Basic model availability check
    if (!Payment || !Order) { throw new Error('MODEL_NOT_AVAILABLE'); }

    const ord = await Order.findById(orderId).lean();
    if (!ord) { throw new Error('ORDER_NOT_FOUND'); }
    if (ord.paymentsLocked === true || (ord.closed && ord.closed.success === false)) { throw new Error('PAYMENTS_LOCKED'); }
    if (ord.closed && ord.closed.success === true) { throw new Error('ORDER_CLOSED'); }

    const baseTotal = (ord.totals && typeof ord.totals.grandTotal === 'number') ? ord.totals.grandTotal : 0;

    // Aggregate current payments for the order to compute balance
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

    // Pick a cash register: prefer default, then system main, then any
    let cash = null;
    try {
      if (CashRegister) {
        cash = await CashRegister.findOne({ defaultForLocation: true }).lean();
        if (!cash) {
          cash = await CashRegister.findOne({ isSystem: true, code: 'main' }).lean().catch(() => null);
        }
        if (!cash) {
          cash = await CashRegister.findOne({}).lean();
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

    // Audit log
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

    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;

    // DEV branch: compute from in-memory payments and store in DEV payroll store
    if (!mongoReady) {
      const devPaymentsStore = require('./devPaymentsStore');
      const devPayrollStore = require('./devPayrollStore');

      const payments = devPaymentsStore.getItems().filter((p) => p.orderId === orderId);
      let income = 0; let expense = 0; let refund = 0;
      payments.forEach((p) => {
        if (p.type === 'income') income += Number(p.amount || 0);
        if (p.type === 'expense') expense += Number(p.amount || 0);
        if (p.type === 'refund') refund += Number(p.amount || 0);
      });
      const base = Math.max(income - expense - refund, 0);

      const pct = typeof percent === 'number' ? percent : Number(process.env.PAYROLL_PERCENT || 0.1);
      const computed = typeof amount === 'number' && amount > 0 ? amount : Math.max(Math.round(base * pct), 0);

      if (!(computed > 0)) {
        console.warn('[payrollAccrual][DEV] skip: NO_AMOUNT', { base, pct });
        return { ok: true, skipped: true, reason: 'NO_AMOUNT' };
      }

      const id = devPayrollStore.nextId();
      devPayrollStore.pushItem({
        _id: id,
        orderId,
        employeeId: userId || undefined,
        amount: computed,
        percent: pct,
        baseAmount: base,
        createdBy: userId || undefined,
        note: 'auto: payrollAccrual',
      });
      console.log('[payrollAccrual][DEV] created', { id, amount: computed });
      return { ok: true, id };
    }

    // Mongo branch: persist accrual via PayrollAccrual model
    let PayrollAccrual;
    try { PayrollAccrual = require('../server/models/PayrollAccrual'); } catch (e) {}

    if (!Order || !PayrollAccrual) { throw new Error('MODEL_NOT_AVAILABLE'); }

    const ord = await Order.findById(orderId).lean();
    if (!ord) { throw new Error('ORDER_NOT_FOUND'); }

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

// Stock models
let StockItem; let StockMovement;
try { StockItem = require('../server/models/StockItem'); } catch (e) {}
try { StockMovement = require('../server/models/StockMovement'); } catch (e) {}

// Templates access (DEV store + Mongo models)
const TemplatesStore = require('./templatesStore');

let NotifyTemplate; let
  DocTemplate;
try { NotifyTemplate = require('../models/NotifyTemplate'); } catch (e) {}
try { DocTemplate = require('../models/DocTemplate'); } catch (e) {}

// File store
const fileStore = require('./fileStore');

// In DEV (no Mongo), keep flags in memory
const memFlags = new Map(); // orderId => { paymentsLocked: true, closed: { success:false, at, by }, files: [] }
const devOutbox = []; // notify dry-run outbox
function getOutbox() { return devOutbox.slice(); }
function isPaymentsLocked(orderId) {
  const s = memFlags.get(orderId);
  return !!(s && s.paymentsLocked);
}
function __devReset() { memFlags.clear(); devOutbox.length = 0; }
function getDevState(orderId) { return memFlags.get(orderId) || null; }

async function markCloseWithoutPayment({
  orderId, userId, statusCode, logId,
}) {
  console.log('[closeWithoutPayment] mark', {
    orderId, userId, statusCode, logId,
  });
  const now = new Date();
  const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;

  if (mongoReady) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        console.warn('[closeWithoutPayment] order not found (mongo)', { orderId });
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
      console.error('[closeWithoutPayment] mongo error', err);
      throw err;
    }
  }

  memFlags.set(orderId, {
    ...(memFlags.get(orderId) || {}),
    paymentsLocked: true,
    closed: { success: false, at: now.toISOString(), by: userId },
  });
  return { ok: true };
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
async function pickTemplate(mongoReady, type, idOrCode) {
  if (!idOrCode) return null;
  if (!mongoReady) {
    return type === 'notify' ? TemplatesStore.getNotifyTemplate(idOrCode) : TemplatesStore.getDocTemplate(idOrCode);
  }
  if (type === 'notify' && NotifyTemplate) {
    const byId = await NotifyTemplate.findById(idOrCode).lean().catch(() => null);
    if (byId) return byId;
    return await NotifyTemplate.findOne({ code: idOrCode }).lean();
  }
  if (type === 'doc' && DocTemplate) {
    const byId = await DocTemplate.findById(idOrCode).lean().catch(() => null);
    if (byId) return byId;
    return await DocTemplate.findOne({ code: idOrCode }).lean();
  }
  return null;
}

// Real adapters
notifyAdapter = {
  async send(channel, templateId, context) {
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    const tpl = mongoReady ? (await pickTemplate(true, 'notify', templateId)) : (await pickTemplate(false, 'notify', templateId));
    console.log('[DEBUG][notifyAdapter] mongoReady=', mongoReady, 'templateId=', templateId, 'tpl=', tpl);
    if (!tpl) { console.warn('[notify] template not found', templateId); throw new Error(`INVALID_REFERENCE_NOTIFY:${templateId}`); }

    const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';
    const to = (context.client && context.client.email) || process.env.SMTP_TO || 'dev@example.com';
    const subject = renderVars(tpl.subject, { order: { id: context.orderId }, client: context.client || {} });
    const html = renderVars(tpl.bodyHtml, { order: { id: context.orderId }, client: context.client || {} });

    const DRY = process.env.NOTIFY_DRY_RUN === '1';
    if (DRY) {
      const item = {
        type: 'notify', at: Date.now(), to, from: SMTP_FROM, subject, html, orderId: context.orderId, templateId,
      };
      devOutbox.push(item);
      console.log('[notify][DRY_RUN] outbox append', item);
      return { ok: true, dryRun: true };
    }

    const host = process.env.SMTP_HOST; const
      port = Number(process.env.SMTP_PORT || 0) || 587;
    const user = process.env.SMTP_USER; const
      pass = process.env.SMTP_PASS;
    if (!host || !port || !user || !pass) {
      console.warn('[notify] SMTP config missing, falling back to DRY_RUN');
      const item = {
        type: 'notify', at: Date.now(), to, from: SMTP_FROM, subject, html, orderId: context.orderId, templateId, fallback: true,
      };
      devOutbox.push(item);
      return { ok: true, dryRun: true };
    }

    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (e) {
      console.warn('[notify] nodemailer not installed, DRY fallback');
      const item = {
        type: 'notify', at: Date.now(), to, from: SMTP_FROM, subject, html, orderId: context.orderId, templateId, fallback: true,
      };
      devOutbox.push(item);
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
    if (mongoReady) {
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
    const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
    const tpl = mongoReady ? (await pickTemplate(true, 'doc', docId)) : (await pickTemplate(false, 'doc', docId));
    if (!tpl) { console.warn('[print] template not found', docId); throw new Error(`INVALID_REFERENCE_PRINT:${docId}`); }

    const html = renderVars(tpl.bodyHtml, { order: { id: orderId } });
    const DRY = process.env.PRINT_DRY_RUN === '1';

    // DRY-RUN: do NOT generate or store PDF, write to DEV outbox
    if (DRY) {
      const item = {
        type: 'print', at: Date.now(), orderId, docId, code: tpl.code || 'doc', htmlPreview: html,
      };
      devOutbox.push(item);
      console.log('[print][DRY_RUN] outbox append', item);
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

    if (mongoReady) {
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
    } else {
      const st = memFlags.get(orderId) || {};
      const files = Array.isArray(st.files) ? st.files.slice() : [];
      files.push({
        id: fileId, name: meta.name, mime: meta.mime, size: meta.size, createdAt: meta.createdAt,
      });
      memFlags.set(orderId, { ...st, files });
    }

    console.log('[print] file stored', { fileId, orderId });
    return { ok: true, fileId };
  },
};

// --- New: stock issue adapter ---
async function issueStockFromOrder({ orderId, userId }) {
  const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
  if (!mongoReady || !StockItem || !StockMovement) {
    console.log('[stockIssue][DEV] skip (mongo not ready or models missing)', { orderId });
    return { ok: true, dryRun: true, issued: 0 };
  }

  const order = await Order.findById(orderId).lean();
  if (!order) { throw new Error('ORDER_NOT_FOUND'); }
  const lines = Array.isArray(order.items) ? order.items : [];
  let issued = 0;
  for (const ln of lines) {
    const itemId = ln && ln.itemId ? ln.itemId : null;
    const qty = ln && typeof ln.qty === 'number' ? ln.qty : 0;
    if (!itemId || qty <= 0) continue;

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
            const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
            const refId = action.templateId || action.code;
            const tplCheck = refId ? (mongoReady ? (await pickTemplate(true, 'notify', refId)) : (await pickTemplate(false, 'notify', refId))) : null;
            if (!tplCheck) throw new Error(`INVALID_REFERENCE_NOTIFY:${refId || 'null'}`);
            await notifyAdapter.send(action.channel || 'email', refId, {
              orderId, statusCode, logId, userId,
            });
          }
          break;
        case 'print':
          {
            const mongoReady = mongoose.connection && mongoose.connection.readyState === 1;
            const refId = action.docId || action.code;
            const tplCheck = refId ? (mongoReady ? (await pickTemplate(true, 'doc', refId)) : (await pickTemplate(false, 'doc', refId))) : null;
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
  handleStatusActions, markCloseWithoutPayment, isPaymentsLocked, __devReset, getDevState, getOutbox,
};