/* eslint camelcase: off */
const express = require('express');

const router = express.Router();
const DetailingOrder = require('../models/DetailingOrder');
const { requireRoles } = require('../middleware/auth');

// @route   GET api/detailing-orders
// @desc    Get all detailing orders
// @access  Authenticated
router.get('/', async (req, res) => {
  try {
    const orders = await DetailingOrder.find().sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/detailing-orders/batch?ids=1,2,3
// @desc    Get multiple detailing orders by ids
// @access  Authenticated
router.get('/batch', async (req, res) => {
  try {
    const idsParam = (req.query.ids || '').trim();
    if (!idsParam) return res.json([]);
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const orders = await DetailingOrder.find({ _id: { $in: ids } });
    return res.json(orders);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/detailing-orders/:id
// @desc    Get detailing order by ID
// @access  Authenticated
router.get('/:id', async (req, res) => {
  try {
    const order = await DetailingOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }

    return res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   POST api/detailing-orders
// @desc    Create a detailing order
// @access  Restricted
router.post('/', requireRoles('Admin', 'Manager', 'Detailing'), async (req, res) => {
  const {
    client_id,
    service,
    status,
    box,
    start,
    end,
    materials_cost,
    labor_cost,
    total,
    notes,
  } = req.body;

  try {
    const newOrder = new DetailingOrder({
      client_id,
      service,
      status,
      box,
      start,
      end,
      materials_cost,
      labor_cost,
      total,
      notes,
    });

    const order = await newOrder.save();
    return res.json(order);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   PUT api/detailing-orders/:id
// @desc    Update a detailing order
// @access  Restricted
router.put('/:id', requireRoles('Admin', 'Manager', 'Detailing'), async (req, res) => {
  const {
    client_id,
    service,
    status,
    box,
    start,
    end,
    materials_cost,
    labor_cost,
    total,
    notes,
  } = req.body;

  // Build order object
  const orderFields = {};
  if (client_id) orderFields.client_id = client_id;
  if (service) orderFields.service = service;
  if (status) orderFields.status = status;
  if (box) orderFields.box = box;
  if (start) orderFields.start = start;
  if (end) orderFields.end = end;
  if (materials_cost) orderFields.materials_cost = materials_cost;
  if (labor_cost) orderFields.labor_cost = labor_cost;
  if (total) orderFields.total = total;
  if (notes) orderFields.notes = notes;

  try {
    let order = await DetailingOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }

    order = await DetailingOrder.findByIdAndUpdate(
      req.params.id,
      { $set: orderFields },
      { new: true },
    );

    return res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   DELETE api/detailing-orders/:id
// @desc    Delete a detailing order
// @access  Restricted
router.delete('/:id', requireRoles('Admin', 'Manager', 'Detailing'), async (req, res) => {
  try {
    const order = await DetailingOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }

    await DetailingOrder.findByIdAndRemove(req.params.id);

    return res.json({ msg: 'Заказ удален' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Заказ не найден' });
    }
    return res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/detailing-orders/client/:clientId
// @desc    Get all orders for a specific client
// @access  Authenticated
router.get('/client/:clientId', async (req, res) => {
  try {
    const orders = await DetailingOrder.find({ client_id: req.params.clientId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;
