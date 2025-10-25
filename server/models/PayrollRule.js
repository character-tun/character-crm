const mongoose = require('mongoose');

const { Schema } = mongoose;

// scope: service|order|item|shop
// base: percent|fixed
// source: margin|revenue
// target: executor|manager
const PayrollRuleSchema = new Schema({
  code: { type: String },
  name: { type: String },
  scope: { type: String, enum: ['service', 'order', 'item', 'shop'], required: true },
  base: { type: String, enum: ['percent', 'fixed'], required: true },
  source: { type: String, enum: ['margin', 'revenue'], required: true },
  target: { type: String, enum: ['executor', 'manager'], required: true },
  value: { type: Number, required: true }, // percent (0..1) or fixed amount
  active: { type: Boolean, default: true },
  conditions: { type: Object },
}, { timestamps: true });

PayrollRuleSchema.index({ active: 1 });
PayrollRuleSchema.index({ code: 1 }, { sparse: true });

module.exports = mongoose.models.PayrollRule || mongoose.model('PayrollRule', PayrollRuleSchema);