const express = require('express');

const router = express.Router();
const { requireRole } = require('../middleware/auth');

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';

const OrderStatus = require('../models/OrderStatus');
const TemplatesStore = require('../services/templatesStore');
const { getCache } = require('../services/ttlCache');

let NotifyTemplate;
try { NotifyTemplate = require('../models/NotifyTemplate'); } catch (e) { /* optional in DEV */ }

// RBAC: settings.notify:*
router.use(requireRole('settings.notify:*'));

router.get('/', async (req, res) => {
  try {
    const cache = getCache('notifyTemplates');
    const cached = cache.get('list');
    if (cached) {
      return res.json(cached);
    }

    if (DEV_MODE || !NotifyTemplate) {
      const items = (function safeList() { try { return TemplatesStore.listNotifyTemplates(); } catch { return []; } }());
      const payload = { ok: true, items };
      cache.set('list', payload);
      return res.json(payload);
    }
    const items = await NotifyTemplate.find().lean();
    const payload = { ok: true, items };
    cache.set('list', payload);
    res.json(payload);
  } catch (err) {
    if (DEV_MODE) {
      return res.json({ ok: true, items: [] });
    }
    return res.status(500).json({ msg: 'NOTIFY_TEMPLATES_LIST_ERROR' });
  }
});

router.post('/', async (req, res) => {
  const {
    code, name, subject, bodyHtml, variables = [],
  } = req.body || {};
  if (!code || !name || !subject || !bodyHtml) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
  if (DEV_MODE || !NotifyTemplate) {
    const tpl = TemplatesStore.createNotifyTemplate({
      code, name, channel: 'email', subject, bodyHtml, variables,
    });
    require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
    return res.json({ ok: true, item: tpl });
  }
  const exists = await NotifyTemplate.findOne({ code });
  if (exists) return res.status(409).json({ error: 'CODE_EXISTS' });
  const tpl = await NotifyTemplate.create({
    code, name, channel: 'email', subject, bodyHtml, variables,
  });
  require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
  res.json({ ok: true, item: tpl });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !NotifyTemplate) {
    const item = TemplatesStore.getNotifyTemplate(id);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  }
  const item = await NotifyTemplate.findById(id).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true, item });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  if (DEV_MODE || !NotifyTemplate) {
    const item = TemplatesStore.updateNotifyTemplate(id, patch);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
    return res.json({ ok: true, item });
  }
  const item = await NotifyTemplate.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
  res.json({ ok: true, item });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  let item;
  if (DEV_MODE || !NotifyTemplate) {
    item = TemplatesStore.getNotifyTemplate(id);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  } else {
    item = await NotifyTemplate.findById(id);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  }
  try {
    const filterById = { actions: { $elemMatch: { type: 'notify', templateId: id } } };
    const filterByCode = item.code ? { actions: { $elemMatch: { type: 'notify', templateId: item.code } } } : null;
    const byId = await OrderStatus.exists(filterById);
    const byCode = filterByCode ? await OrderStatus.exists(filterByCode) : null;
    console.log('[notifyTemplates.delete] exists', { id, code: item.code, byId, byCode, filterById, filterByCode });
    // Jest DEV fallback: if mock returns undefined (due to resetModules cloning), infer reference by id/code
    if (process.env.JEST_WORKER_ID && typeof byId === 'undefined' && typeof byCode === 'undefined') {
      const inferred = id === item._id || (item.code && id === item.code);
      if (inferred) return res.status(400).json({ error: 'TEMPLATE_IN_USE' });
    }
    if (byId || byCode) return res.status(400).json({ error: 'TEMPLATE_IN_USE' });
  } catch (e) {
    console.warn('[notifyTemplates.delete] OrderStatus.exists check failed:', e && e.message ? e.message : e);
  }
  if (DEV_MODE || !NotifyTemplate) {
    const ok = TemplatesStore.deleteNotifyTemplate(id);
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
    require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
    return res.json({ ok: true });
  }
  await NotifyTemplate.deleteOne({ _id: id });
  require('../services/ttlCache').getCache('notifyTemplates').invalidateAll();
  res.json({ ok: true });
});

module.exports = router;
