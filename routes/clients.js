const express = require('express');

const router = express.Router();
const Client = require('../models/Client');
const { requireRoles } = require('../middleware/auth');
const { getActiveSchema } = require('../services/fieldSchemaProvider');

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
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/clients/:id
// @desc    Get client by ID
// @access  Authenticated
router.get('/:id', async (req, res) => {
  try {
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
router.post('/', requireRoles('Admin', 'Manager', 'Detailing', 'Production', 'Finance'), validateRequiredFields, async (req, res) => {
  const {
    name, phone, telegram, city, vehicle, tags, notes,
  } = req.body;

  try {
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
router.put('/:id', requireRoles('Admin', 'Manager', 'Detailing', 'Production', 'Finance'), validateRequiredFields, async (req, res) => {
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
router.delete('/:id', requireRoles('Admin', 'Manager', 'Detailing', 'Production', 'Finance'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }

    await Client.findByIdAndRemove(req.params.id);

    res.json({ msg: 'Клиент удален' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Клиент не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;
