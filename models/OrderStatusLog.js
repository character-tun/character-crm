const mongoose = require('mongoose');

const OrderStatusLogSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  from: { type: String, match: /^[a-z0-9-]{2,40}$/ },
  to: { type: String, required: true, match: /^[a-z0-9-]{2,40}$/ },
  userId: { type: mongoose.Schema.Types.ObjectId },
  note: { type: String },
  actionsEnqueued: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now },
});

OrderStatusLogSchema.index({ orderId: 1, createdAt: 1 });

module.exports = mongoose.model('OrderStatusLog', OrderStatusLogSchema);
