const mongoose = require('mongoose');

const { Schema } = mongoose;

const StockBalanceSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
  qty: { type: Number, required: true },
  adjustment: { type: Boolean, default: false },
  ts: { type: Date, default: () => new Date() },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

StockBalanceSchema.index({ itemId: 1, locationId: 1, ts: -1 });

module.exports = mongoose.models.StockBalance || mongoose.model('StockBalance', StockBalanceSchema);