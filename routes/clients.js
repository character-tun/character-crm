const express = require('express');

const router = express.Router();
const Client = require('../models/Client');
const { requirePermission } = require('../middleware/auth');
const { getActiveSchema } = require('../services/fieldSchemaProvider');

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const { randomUUID } = require('crypto');
const devClients = [
  { _id: randomUUID(), name: 'Иван Петров', phone: '+7 999 123-45-67', telegram: '@ivanp', city: 'Москва', vehicle: 'Sedan', tags: [], notes: '', createdAt: new Date().toISOString() },
  { _id: randomUUID(), name: 'Анна Сидорова', phone: '+7 999 765-43-21', telegram: '@annas', city: 'Санкт-Петербург', vehicle: 'Hatchback', tags: [], notes: '', createdAt: new Date().toISOString() },
];

function filterClientsMem(items, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return items.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const includes = (v) => String(v || '').toLowerCase().includes(s);
  return items
    .filter((c) => includes(c.name) || includes(c.phone) || includes(c.telegram) || includes(c.city) || includes(c.vehicle))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// Helper: extract value by code from body (supports nested `fields` map)
function getVal(body, code) {
  if (!body || !code) return undefined;
  if (Object.prototype.hasOwnProperty.call(body, code)) return body[code];
  if (body.fields && Object.prototype.hasOwnProperty.call(body.fields, code)) return body.fields[code];
  return undefined;
}

function isEmptyValueByType(val, type) {
  switch (type) {
    case 'text': return !(typeof val === 'string' && val.trim().length > 0);
    case 'number': return !(typeof val === 'number' && Number.isFinite(val));
    case 'date': return !(val && !Number.isNaN(new Date(val).getTime()));
    case 'bool': return (typeof val !== 'boolean'); // presence is required; false is allowed but must be boolean
    case 'list': return !(typeof val === 'string' && val.trim().length > 0);
    case 'multilist': return !(Array.isArray(val) && val.length > 0);
    default: return val == null;
  }
}

async function validateRequiredFields(req, res, next) {
  try {
    const schema = await getActiveSchema('clients', 'Форма клиента');
    if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) return next();

    const required = schema.fields.filter((f) => f && f.required === true);
    if (!required.length) return next();

    const missing = [];
    for (const f of required) {
      const val = getVal(req.body, f.code);
      if (isEmptyValueByType(val, f.type)) {
        missing.push(f.code);
      }
    }

    if (missing.length) {
      return res.status(400).json({ error: 'REQUIRED_FIELDS_MISSING', fields: missing });
    }

    return next();
  } catch (e) {
    return next();
  }
}

// @route   GET api/clients
// @desc    Get all clients
// @access  Authenticated
router.get('/', requirePermission('clients.read'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (DEV_MODE) {
      const items = filterClientsMem(devClients, q);
      return res.json({ ok: true, items });
    }
    const match = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
            { telegram: { $regex: q, $options: 'i' } },
            { city: { $regex: q, $options: 'i' } },
            { vehicle: { $regex: q, $options: 'i' } },
          ],
        }
      : {};
    const clients = await Client.find(match).sort({ createdAt: -1 });
    return res.json({ ok: true, items: clients });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/clients/:id
// @desc    Get client by ID
// @access  Authenticated
router.get('/:id', requirePermission('clients.read'), async (req, res) => {
  try {
    if (DEV_MODE) {
      const c = devClients.find((x) => String(x._id) === String(req.params.id));
      if (!c) return res.status(404).json({ msg: 'Клиент не найден' });
      return res.json(c);
    }
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }

    res.json(client);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

// @route   POST api/clients
// @desc    Create a client
// @access  Restricted
router.post('/', requirePermission('clients.write'), validateRequiredFields, async (req, res) => {
  const {
    name, phone, telegram, city, vehicle, tags, notes,
  } = req.body;

  try {
    if (DEV_MODE) {
      const created = {
        _id: randomUUID(),
        name,
        phone,
        telegram,
        city,
        vehicle,
        tags: Array.isArray(tags) ? tags : [],
        notes,
        createdAt: new Date().toISOString(),
      };
      devClients.push(created);
      return res.json(created);
    }
    const newClient = new Client({
      name,
      phone,
      telegram,
      city,
      vehicle,
      tags,
      notes,
    });

    const client = await newClient.save();
    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   PUT api/clients/:id
// @desc    Update a client
// @access  Restricted
router.put('/:id', requirePermission('clients.write'), validateRequiredFields, async (req, res) => {
  const {
    name, phone, telegram, city, vehicle, tags, notes,
  } = req.body;

  // Build client object
  const clientFields = {};
  if (name) clientFields.name = name;
  if (phone) clientFields.phone = phone;
  if (telegram) clientFields.telegram = telegram;
  if (city) clientFields.city = city;
  if (vehicle) clientFields.vehicle = vehicle;
  if (tags) clientFields.tags = tags;
  if (notes) clientFields.notes = notes;

  try {
    if (DEV_MODE) {
      const idx = devClients.findIndex((x) => String(x._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ msg: 'Клиент не найден' });
      const next = { ...devClients[idx], ...clientFields, updatedAt: new Date().toISOString() };
      devClients[idx] = next;
      return res.json(next);
    }
    let client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }

    client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: clientFields },
      { new: true },
    );

    res.json(client);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

// @route   DELETE api/clients/:id
// @desc    Delete a client
// @access  Restricted
router.delete('/:id', requirePermission('clients.write'), async (req, res) => {
  try {
    if (DEV_MODE) {
      const idx = devClients.findIndex((x) => String(x._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ msg: 'Клиент не найден' });
      const removed = devClients[idx];
      devClients.splice(idx, 1);
      return res.json({ ok: true, id: removed._id });
    }
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }

    await Client.findByIdAndRemove(req.params.id);

    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;
