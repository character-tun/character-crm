const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  uom: { type: String, default: '' },
  type: { type: String, enum: ['good', 'service'], default: 'good' },
  sku: { type: String, default: '' },
  brand: { type: String, default: '' },
  group: { type: String, default: '' },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: { type: [String], default: [] },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  locked: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.models.Item || mongoose.model('Item', ItemSchema);
