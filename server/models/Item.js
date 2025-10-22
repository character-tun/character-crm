const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  sku: { type: String, default: '' },
  tags: { type: [String], default: [] },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  locked: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.models.Item || mongoose.model('Item', ItemSchema);