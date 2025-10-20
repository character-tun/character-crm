const express = require('express');

const router = express.Router();
const Client = require('../models/Client');
const { requireRoles } = require('../middleware/auth');

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
router.post('/', requireRoles('Admin', 'Manager', 'Detailing', 'Production', 'Finance'), async (req, res) => {
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
router.put('/:id', requireRoles('Admin', 'Manager', 'Detailing', 'Production', 'Finance'), async (req, res) => {
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
