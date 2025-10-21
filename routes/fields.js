const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const { requireRoles } = require('../middleware/auth');

let FieldSchemaModel; try { FieldSchemaModel = require('../server/models/FieldSchema'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// In-memory store for DEV mode / no Mongo
const memStore = { items: [] }; // {_id, scope, name, version, isActive, note, createdBy, createdAt, fields: []}

const genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const validateFieldsSpec = (fields = []) => {
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i] || {};
    if ((f.type === 'list' || f.type === 'multilist') && (!Array.isArray(f.options) || f.options.length === 0)) {
      return { ok: false, error: 'FIELD_OPTIONS_REQUIRED', path: `fields.${i}.options` };
    }
  }
  return { ok: true };
};

router.use(requireRoles('Admin', 'Manager'));

router.get('/', async (req, res) => {
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    return res.json({ ok: true, items: memStore.items.slice().sort((a, b) => (a.scope === b.scope && a.name === b.name ? b.version - a.version : a.scope.localeCompare(b.scope) || a.name.localeCompare(b.name))) });
  }
  const items = await FieldSchemaModel.find().sort({ scope: 1, name: 1, version: -1 }).lean();
  return res.json({ ok: true, items });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const item = memStore.items.find((x) => String(x._id) === String(id));
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ ok: true, item });
  }
  const item = await FieldSchemaModel.findById(id).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json({ ok: true, item });
});

router.get('/:scope/:name/versions', async (req, res) => {
  const { scope, name } = req.params;
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const items = memStore.items.filter((x) => x.scope === scope && x.name === name).sort((a, b) => b.version - a.version);
    return res.json({ ok: true, items });
  }
  const items = await FieldSchemaModel.find({ scope, name }).sort({ version: -1 }).lean();
  return res.json({ ok: true, items });
});

router.post('/', async (req, res) => {
  const {
    scope, name, fields = [], note,
  } = req.body || {};
  if (!scope || !name) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  const vf = validateFieldsSpec(fields);
  if (!vf.ok) return res.status(400).json({ error: vf.error });

  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const latest = memStore.items.filter((x) => x.scope === scope && x.name === name).sort((a, b) => b.version - a.version)[0];
    const version = latest ? latest.version + 1 : 1;
    const item = {
      _id: genId(), scope, name, fields, note: note || '', version,
      isActive: true, createdBy: req.user && req.user.id ? req.user.id : null, createdAt: new Date(),
    };
    // Set others inactive
    memStore.items.forEach((x) => { if (x.scope === scope && x.name === name) x.isActive = false; });
    memStore.items.push(item);
    return res.json({ ok: true, item });
  }

  try {
    const latest = await FieldSchemaModel.findOne({ scope, name }).sort({ version: -1 }).lean();
    const version = latest ? (latest.version || 0) + 1 : 1;
    const createdBy = (req.user && mongoose.isValidObjectId(req.user.id)) ? req.user.id : undefined;
    const item = await FieldSchemaModel.create({ scope, name, fields, note, version, isActive: true, createdBy });
    await FieldSchemaModel.updateMany({ scope, name, _id: { $ne: item._id } }, { $set: { isActive: false } });
    return res.json({ ok: true, item });
  } catch (e) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
});

// Alias endpoint for migrations: POST /api/fields/schemas
router.post('/schemas', async (req, res) => {
  const { scope, name, fields = [], note } = req.body || {};
  if (!scope || !name) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  const vf = validateFieldsSpec(fields);
  if (!vf.ok) return res.status(400).json({ error: vf.error });

  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const latest = memStore.items.filter((x) => x.scope === scope && x.name === name).sort((a, b) => b.version - a.version)[0];
    const version = latest ? latest.version + 1 : 1;
    const item = {
      _id: genId(), scope, name, fields, note: note || '', version,
      isActive: true, createdBy: req.user && req.user.id ? req.user.id : null, createdAt: new Date(),
    };
    memStore.items.forEach((x) => { if (x.scope === scope && x.name === name) x.isActive = false; });
    memStore.items.push(item);
    return res.json({ ok: true, item });
  }

  try {
    const latest = await FieldSchemaModel.findOne({ scope, name }).sort({ version: -1 }).lean();
    const version = latest ? (latest.version || 0) + 1 : 1;
    const createdBy = (req.user && mongoose.isValidObjectId(req.user.id)) ? req.user.id : undefined;
    const item = await FieldSchemaModel.create({ scope, name, fields, note, version, isActive: true, createdBy });
    await FieldSchemaModel.updateMany({ scope, name, _id: { $ne: item._id } }, { $set: { isActive: false } });
    return res.json({ ok: true, item });
  } catch (e) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { fields, note } = req.body || {};
  if (fields) {
    const vf = validateFieldsSpec(fields);
    if (!vf.ok) return res.status(400).json({ error: vf.error });
  }

  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const idx = memStore.items.findIndex((x) => String(x._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    if (Array.isArray(fields)) memStore.items[idx].fields = fields;
    if (typeof note === 'string') memStore.items[idx].note = note;
    return res.json({ ok: true, item: memStore.items[idx] });
  }

  const doc = await FieldSchemaModel.findById(id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  if (Array.isArray(fields)) doc.fields = fields;
  if (typeof note === 'string') doc.note = note;
  await doc.save();
  return res.json({ ok: true, item: doc.toObject() });
});

router.post('/:id/activate', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const doc = memStore.items.find((x) => String(x._id) === String(id));
    if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
    memStore.items.forEach((x) => { if (x.scope === doc.scope && x.name === doc.name) x.isActive = false; });
    doc.isActive = true;
    return res.json({ ok: true, item: doc });
  }
  const doc = await FieldSchemaModel.findById(id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  await FieldSchemaModel.updateMany({ scope: doc.scope, name: doc.name, _id: { $ne: doc._id } }, { $set: { isActive: false } });
  doc.isActive = true;
  await doc.save();
  return res.json({ ok: true, item: doc.toObject() });
});

router.post('/:id/deactivate', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const doc = memStore.items.find((x) => String(x._id) === String(id));
    if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
    doc.isActive = false;
    return res.json({ ok: true, item: doc });
  }
  const doc = await FieldSchemaModel.findById(id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  doc.isActive = false;
  await doc.save();
  return res.json({ ok: true, item: doc.toObject() });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (DEV_MODE || !FieldSchemaModel || !mongoReady()) {
    const idx = memStore.items.findIndex((x) => String(x._id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' });
    if (memStore.items[idx].isActive) return res.status(409).json({ error: 'DELETE_ACTIVE_FORBIDDEN' });
    memStore.items.splice(idx, 1);
    return res.json({ ok: true });
  }
  const doc = await FieldSchemaModel.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  if (doc.isActive) return res.status(409).json({ error: 'DELETE_ACTIVE_FORBIDDEN' });
  await FieldSchemaModel.deleteOne({ _id: id });
  return res.json({ ok: true });
});

module.exports = router;