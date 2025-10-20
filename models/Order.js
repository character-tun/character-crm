const mongoose = require('mongoose');

const ClosedSchema = new mongoose.Schema({
  success: { type: Boolean },
  at: { type: Date },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderType', required: true, index: true },
  status: { type: String, index: true },
  statusChangedAt: { type: Date },
  closed: { type: ClosedSchema, default: undefined },
  paymentsLocked: { type: Boolean, default: false },
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