const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const BoxSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  name: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    default: 1
  }
});

module.exports = mongoose.model('Box', BoxSchema);