const mongoose = require('mongoose');

const ClosedSchema = new mongoose.Schema({
  success: { type: Boolean },
  at: { type: Date },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderType', required: true, index: true },
  clientId: { type: String, ref: 'Client', index: true },
  status: { type: String, index: true },
  statusChangedAt: { type: Date },
  closed: { type: ClosedSchema, default: undefined },
  paymentsLocked: { type: Boolean, default: false },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    qty: { type: Number, default: 1 },
    total: { type: Number, default: 0 },
    snapshot: {
      name: { type: String },
      price: { type: Number },
      unit: { type: String },
      sku: { type: String },
      tags: { type: [String], default: [] },
      note: { type: String },
    },
    snapshotAt: { type: Date, default: Date.now },
  }],
  totals: {
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  files: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
  collection: 'orders',
});

// Compound index to optimize queries by status and statusChangedAt
OrderSchema.index({ status: 1, statusChangedAt: 1 });

module.exports = mongoose.model('Order', OrderSchema);