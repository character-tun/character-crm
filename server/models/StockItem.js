const mongoose = require('mongoose');

const { Schema } = mongoose;

const StockItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  qtyOnHand: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
  minQty: { type: Number, default: 0 },
  maxQty: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

// Indexes for fast lookups
StockItemSchema.index({ itemId: 1 });
StockItemSchema.index({ locationId: 1 });
StockItemSchema.index({ qtyOnHand: 1 });

module.exports = mongoose.models.StockItem || mongoose.model('StockItem', StockItemSchema);
