const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { requireRoles } = require('../middleware/auth');

let DictionaryModel; try { DictionaryModel = require('../server/models/Dictionary'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// In-memory store for DEV mode / no Mongo
const memStore = { items: [] }; // {_id, code, values, updatedAt}

const genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

router.use(requireRoles('Admin', 'Manager'));

router.get('/', async (req, res) => {
  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    const items = memStore.items.slice().sort((a, b) => a.code.localeCompare(b.code));
    return res.json({ ok: true, items });
  }
  const items = await DictionaryModel.find().sort({ code: 1 }).lean();
  return res.json({ ok: true, items });
});

router.get('/by-code/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toLowerCase();
  if (!code) return res.status(404).json({ error: 'NOT_FOUND' });
  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    const item = memStore.items.find((x) => x.code === code);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  }
  const item = await DictionaryModel.findOne({ code }).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json({ ok: true, item });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    const item = memStore.items.find((x) => String(x._id) === String(id));
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  }
  const item = await DictionaryModel.findById(id).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json({ ok: true, item });
});

router.post('/', async (req, res) => {
  let { code, values = [] } = req.body || {};
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  code = code.trim().toLowerCase();
  values = Array.isArray(values) ? values : [];

  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    if (memStore.items.some((x) => x.code === code)) return res.status(409).json({ error: 'CODE_EXISTS' });
    const item = { _id: genId(), code, values, updatedAt: new Date() };
    memStore.items.push(item);
    return res.json({ ok: true, item });
  }

  try {
    const item = await DictionaryModel.create({ code, values });
    return res.json({ ok: true, item });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};

  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    const idx = memStore.items.findIndex((x) => String(x._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    if (typeof patch.code === 'string') {
      const newCode = patch.code.trim().toLowerCase();
      if (memStore.items.some((x, i) => i !== idx && x.code === newCode)) return res.status(409).json({ error: 'CODE_EXISTS' });
      memStore.items[idx].code = newCode;
    }
    if (Array.isArray(patch.values)) memStore.items[idx].values = patch.values;
    memStore.items[idx].updatedAt = new Date();
    return res.json({ ok: true, item: memStore.items[idx] });
  }

  const doc = await DictionaryModel.findById(id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  if (typeof patch.code === 'string') doc.code = patch.code;
  if (Array.isArray(patch.values)) doc.values = patch.values;
  try {
    await doc.save();
    return res.json({ ok: true, item: doc.toObject() });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: 'CODE_EXISTS' });
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !DictionaryModel || !mongoReady()) {
    const idx = memStore.items.findIndex((x) => String(x._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    memStore.items.splice(idx, 1);
    return res.json({ ok: true });
  }
  const doc = await DictionaryModel.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  await DictionaryModel.deleteOne({ _id: id });
  return res.json({ ok: true });
});

module.exports = router;
