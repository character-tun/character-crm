const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ClientSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  telegram: {
    type: String,
  },
  city: {
    type: String,
  },
  vehicle: {
    type: String,
  },
  tags: {
    type: [String],
  },
  notes: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Client', ClientSchema);
