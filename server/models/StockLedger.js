const mongoose = require('mongoose');

const { Schema } = mongoose;

const StockLedgerSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
  qty: { type: Number, required: true },
  cost: { type: Number, default: 0 },
  refType: { type: String, enum: ['movement', 'transfer', 'inventory', 'manual'], default: 'movement' },
  refId: { type: Schema.Types.ObjectId },
  ts: { type: Date, default: () => new Date() },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

// Indexes for efficient queries
StockLedgerSchema.index({ itemId: 1, locationId: 1, ts: -1 });
StockLedgerSchema.index({ refType: 1, refId: 1 });

module.exports = mongoose.models.StockLedger || mongoose.model('StockLedger', StockLedgerSchema);