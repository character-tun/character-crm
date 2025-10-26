const express = require('express');
const TemplatesStore = require('../services/templatesStore');
const { sendMessage: sendTelegram } = require('../services/telegramNotify');

const router = express.Router();

function renderVars(str = '', ctx = {}) {
  return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    try {
      const v = p.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), ctx);
      return v == null ? '' : String(v);
    } catch {
      return '';
    }
  });
}

// Public, unauthenticated endpoints
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'character-crm', ts: Date.now() });
});

router.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/welcome', async (req, res) => {
  try {
    const { channel = 'email', template = 'welcome_tpl', orderId, client = {} } = req.body || {};

    const tpl = TemplatesStore.getNotifyTemplate(template) || null;

    const subject = renderVars((tpl && tpl.subject) || 'Welcome', { order: { id: orderId }, client });
    const html = renderVars((tpl && tpl.bodyHtml) || '<p>Welcome</p>', { order: { id: orderId }, client });

    const result = { ok: true };

    if (channel === 'email' || channel === 'both') {
      const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';
      const to = client.email || process.env.SMTP_TO;
      const DRY = process.env.NOTIFY_DRY_RUN === '1';
      let emailResult;

      if (!to) {
        emailResult = { ok: false, reason: 'MISSING_TO' };
      } else if (DRY) {
        console.log('[public/welcome][DRY_RUN] email', { to, subject });
        emailResult = { ok: true, dryRun: true };
      } else {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 0) || 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        let nodemailer;
        if (!host || !port || !user || !pass) {
          console.warn('[public/welcome] SMTP config missing, DRY fallback');
          emailResult = { ok: true, dryRun: true };
        } else {
          try { nodemailer = require('nodemailer'); } catch (e) {}
          if (!nodemailer) {
            console.warn('[public/welcome] nodemailer not available, DRY fallback');
            emailResult = { ok: true, dryRun: true };
          } else {
            const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
            await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
            emailResult = { ok: true, to };
          }
        }
      }
      result.email = emailResult;
    }

    if (channel === 'telegram' || channel === 'both') {
      const text = `👋 ${subject}`;
      try {
        const tgRes = await sendTelegram(text);
        result.telegram = tgRes;
      } catch (err) {
        result.telegram = { ok: false, error: err.message };
      }
    }

    return res.json(result);
  } catch (e) {
    console.warn('[public/welcome] error', e && e.message);
    return res.status(500).json({ ok: false, error: e && e.message });
  }
});

module.exports = router;
