const mongoose = require('mongoose');

const { Schema } = mongoose;

const StockMovementSchema = new Schema({
  stockItemId: { type: Schema.Types.ObjectId, ref: 'StockItem' },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  type: { type: String, enum: ['receipt', 'issue', 'adjust'], required: true },
  qty: { type: Number, required: true }, // positive for receipt, negative for issue; adjust can be +/-
  note: { type: String },
  source: {
    kind: { type: String, enum: ['order', 'manual', 'supplier', 'system'], default: 'manual' },
    id: { type: Schema.Types.ObjectId },
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

// Indexes
StockMovementSchema.index({ itemId: 1, createdAt: -1 });
StockMovementSchema.index({ type: 1, createdAt: -1 });
StockMovementSchema.index({ 'source.kind': 1 });
StockMovementSchema.index({ 'source.id': 1 });

module.exports = mongoose.models.StockMovement || mongoose.model('StockMovement', StockMovementSchema);
