const mongoose = require('mongoose');

const { Schema } = mongoose;

// StockOperation: canonical operation log for stock movements
const StockOperationSchema = new Schema({
  type: { type: String, enum: ['in', 'out', 'return', 'transfer'], required: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  qty: { type: Number, required: true },
  locationIdFrom: { type: Schema.Types.ObjectId, ref: 'Location' },
  locationIdTo: { type: Schema.Types.ObjectId, ref: 'Location' },
  sourceType: { type: String },
  sourceId: { type: Schema.Types.ObjectId },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: () => new Date() },
}, { timestamps: true, versionKey: false });

// Indexes per spec
StockOperationSchema.index({ itemId: 1, createdAt: -1 }, { name: 'op_item_createdAt' });
StockOperationSchema.index({ sourceType: 1, sourceId: 1 }, { name: 'op_source' });

module.exports = mongoose.models.StockOperation || mongoose.model('StockOperation', StockOperationSchema);
