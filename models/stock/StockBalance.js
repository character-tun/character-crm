const mongoose = require('mongoose');

const { Schema } = mongoose;

// New stock balance architecture (Week 1): quantity + reservedQuantity
// Note: Uses a distinct model name to avoid collision with existing server/models/StockBalance
const StockBalanceSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  quantity: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  lastUpdatedAt: { type: Date, default: () => new Date() },
}, { timestamps: true, versionKey: false });

// Unique composite index per item/location
StockBalanceSchema.index({ itemId: 1, locationId: 1 }, { unique: true, name: 'uniq_item_location' });

// Optional sanity: ensure quantities are not negative (soft validator)
StockBalanceSchema.path('quantity').validate((v) => v === undefined || v >= 0, 'QUANTITY_NEGATIVE');
StockBalanceSchema.path('reservedQuantity').validate((v) => v === undefined || v >= 0, 'RESERVED_NEGATIVE');

module.exports = mongoose.models.StockBalanceArch || mongoose.model('StockBalanceArch', StockBalanceSchema);