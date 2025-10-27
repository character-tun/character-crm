const mongoose = require('mongoose');
let StockItem; let StockBalance;
try { StockItem = require('../../server/models/StockItem'); } catch (e) {}
try { StockBalance = require('../../models/stock/StockBalance'); } catch (e) {}

const TemplatesStore = require('../templatesStore');
let telegramNotify; try { telegramNotify = require('../telegramNotify'); } catch (e) {}

const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;
let _timer = null;

async function scanAndNotify() {
  if (!mongoReady()) { console.warn('[minStock] skip: DB_NOT_READY'); return { ok: true, skipped: true }; }
  if (!StockItem) { console.warn('[minStock] skip: MODEL_NOT_AVAILABLE'); return { ok: true, skipped: true }; }

  const items = await StockItem.find({ minQty: { $gt: 0 } }).lean();
  const alerts = [];
  for (const it of (items || [])) {
    const itemId = it.itemId; const locId = it.locationId; const min = Number(it.minQty || 0);
    if (!itemId || !locId || !(min > 0)) continue;
    let qty = Number(it.qtyOnHand || 0);
    try {
      if (StockBalance) {
        const bal = await StockBalance.findOne({ itemId: itemId, locationId: locId }).lean();
        if (bal) { qty = Number(bal.quantity || 0) - Number(bal.reservedQuantity || 0); }
      }
    } catch (e) {}
    if (qty <= min) {
      alerts.push({ itemId: String(itemId), locationId: String(locId), qty, minQty: min });
    }
  }

  if (alerts.length === 0) return { ok: true, alerts: [] };

  const tpl = TemplatesStore.getNotifyTemplate('min-stock') || { subject: 'Минимальный остаток', bodyHtml: '<p>Товар {{itemId}} на локации {{locationId}} достиг минимума ({{qty}} ≤ {{minQty}})</p>' };

  for (const a of alerts) {
    // Log
    console.warn('[minStock] ALERT', a);

    // Email via SMTP (simple fallback based on statusActionsHandler notifyAdapter pattern)
    try {
      const DRY = process.env.NOTIFY_DRY_RUN === '1';
      const host = process.env.SMTP_HOST; const port = Number(process.env.SMTP_PORT || 0) || 587;
      const user = process.env.SMTP_USER; const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || 'no-reply@example.com';
      const to = process.env.SMTP_TO || 'dev@example.com';
      const subject = String(tpl.subject || 'Минимальный остаток');
      const html = String((tpl.bodyHtml || '').replace(/\{\{\s*itemId\s*\}\}/g, a.itemId).replace(/\{\{\s*locationId\s*\}\}/g, a.locationId).replace(/\{\{\s*qty\s*\}\}/g, String(a.qty)).replace(/\{\{\s*minQty\s*\}\}/g, String(a.minQty)));
      if (!DRY && host && user && pass) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
        await transporter.sendMail({ from, to, subject, html });
        console.log('[minStock] email sent', { to, subject });
      } else {
        console.log('[minStock] email DRY or SMTP missing, subject:', subject);
      }
    } catch (e) {
      console.warn('[minStock] email send error', e && e.message);
    }

    // Telegram
    try {
      if (telegramNotify && typeof telegramNotify.sendMessage === 'function') {
        await telegramNotify.sendMessage(`⚠️ Мин. остаток: item=${a.itemId} loc=${a.locationId} qty=${a.qty} min=${a.minQty}`);
      }
    } catch (e) {
      console.warn('[minStock] telegram send error', e && e.message);
    }

    // Webhook/callback
    try {
      const url = process.env.MIN_STOCK_WEBHOOK_URL;
      if (url) {
        let axios; try { axios = require('axios'); } catch (e) {}
        if (axios) {
          await axios.post(url, { event: 'min_stock', payload: a });
          console.log('[minStock] webhook sent', { url });
        } else {
          console.warn('[minStock] axios not installed — TODO integrate HTTP client');
        }
      }
    } catch (e) {
      console.warn('[minStock] webhook error', e && e.message);
    }
  }

  return { ok: true, alerts };
}

function start() {
  if (_timer) return { ok: true, already: true };
  const enabled = String(process.env.MIN_STOCK_WATCHER_ENABLED || '1') === '1';
  if (!enabled) return { ok: true, skipped: true };
  const intervalMs = Number(process.env.MIN_STOCK_CHECK_INTERVAL_MS || 60000);
  _timer = setInterval(() => { scanAndNotify().catch((e) => console.warn('[minStock] scan error', e && e.message)); }, intervalMs);
  console.log('[minStock] watcher started', { intervalMs });
  return { ok: true };
}

function stop() { if (_timer) { clearInterval(_timer); _timer = null; } return { ok: true }; }

module.exports = { start, stop, scanAndNotify };