const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const DetailingOrderSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4,
  },
  client_id: {
    type: String,
    ref: 'Client',
    required: true,
  },
  service: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Новый', 'В работе', 'Готов', 'Выдан'],
    default: 'Новый',
  },
  box: {
    type: String,
    ref: 'Box',
  },
  start: {
    type: Date,
  },
  end: {
    type: Date,
  },
  materials_cost: {
    type: Number,
    default: 0,
  },
  labor_cost: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  profit: {
    type: Number,
    get() {
      return this.total - (this.materials_cost + this.labor_cost);
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('DetailingOrder', DetailingOrderSchema);
