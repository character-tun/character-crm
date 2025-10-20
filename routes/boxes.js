const express = require('express');

const router = express.Router();
const Box = require('../models/Box');
const { requireRoles } = require('../middleware/auth');

// @route   GET api/boxes
// @desc    Get all boxes
// @access  Authenticated
router.get('/', async (req, res) => {
  try {
    const boxes = await Box.find();
    res.json(boxes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   GET api/boxes/:id
// @desc    Get box by ID
// @access  Authenticated
router.get('/:id', async (req, res) => {
  try {
    const box = await Box.findById(req.params.id);

    if (!box) {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }

    res.json(box);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

// @route   POST api/boxes
// @desc    Create a box
// @access  Restricted
router.post('/', requireRoles('Admin', 'Production'), async (req, res) => {
  const { name, capacity } = req.body;

  try {
    const newBox = new Box({
      name,
      capacity,
    });

    const box = await newBox.save();
    res.json(box);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   PUT api/boxes/:id
// @desc    Update a box
// @access  Restricted
router.put('/:id', requireRoles('Admin', 'Production'), async (req, res) => {
  const { name, capacity } = req.body;

  // Build box object
  const boxFields = {};
  if (name) boxFields.name = name;
  if (capacity) boxFields.capacity = capacity;

  try {
    let box = await Box.findById(req.params.id);

    if (!box) {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }

    box = await Box.findByIdAndUpdate(
      req.params.id,
      { $set: boxFields },
      { new: true },
    );

    res.json(box);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

// @route   DELETE api/boxes/:id
// @desc    Delete a box
// @access  Restricted
router.delete('/:id', requireRoles('Admin', 'Production'), async (req, res) => {
  try {
    const box = await Box.findById(req.params.id);

    if (!box) {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }

    await Box.findByIdAndRemove(req.params.id);

    res.json({ msg: 'Бокс удален' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Бокс не найден' });
    }
    res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;
