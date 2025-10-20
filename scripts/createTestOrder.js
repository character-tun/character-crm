#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const order = await Order.create({ status: 'new', statusChangedAt: new Date() });
    console.log('ORDER_ID=' + order._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('createTestOrder error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();