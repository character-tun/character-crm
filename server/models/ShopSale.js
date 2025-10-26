const mongoose = require('mongoose');

const { Schema } = mongoose;

const ShopSaleItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
  name: { type: String, required: true },
  sku: { type: String },
  unit: { type: String },
  price: { type: Number, required: true },
  qty: { type: Number, required: true },
}, { _id: false });

const RefundSchema = new Schema({
  amount: { type: Number, required: true },
  reason: { type: String },
  ts: { type: Date, default: () => new Date() },
  by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const TotalsSchema = new Schema({
  subtotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
}, { _id: false });

const ShopSaleSchema = new Schema({
  items: { type: [ShopSaleItemSchema], default: [] },
  totals: { type: TotalsSchema, default: () => ({}) },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
  method: { type: String },
  cashRegisterId: { type: Schema.Types.ObjectId, ref: 'CashRegister' },
  note: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  refunds: { type: [RefundSchema], default: [] },
}, { timestamps: true, versionKey: false });

ShopSaleSchema.index({ createdAt: -1 });
ShopSaleSchema.index({ locationId: 1 });
ShopSaleSchema.index({ cashRegisterId: 1 });

module.exports = mongoose.models.ShopSale || mongoose.model('ShopSale', ShopSaleSchema);
