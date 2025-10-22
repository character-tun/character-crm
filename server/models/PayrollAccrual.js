const mongoose = require('mongoose');

const { Schema } = mongoose;

const PayrollAccrualSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  percent: { type: Number },
  baseAmount: { type: Number },
  orderStatusLogId: { type: Schema.Types.ObjectId, ref: 'OrderStatusLog' },
  note: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

PayrollAccrualSchema.index({ orderId: 1, employeeId: 1 });

module.exports = mongoose.models.PayrollAccrual || mongoose.model('PayrollAccrual', PayrollAccrualSchema);