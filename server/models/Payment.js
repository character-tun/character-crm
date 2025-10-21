const mongoose = require('mongoose');

const { Schema } = mongoose;

const PaymentSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  type: { type: String, enum: ['income', 'expense', 'refund'], required: true },
  articlePath: { type: [String], default: [] },
  amount: { type: Number, required: true, validate: { validator: (v) => v > 0, message: 'AMOUNT_MUST_BE_POSITIVE' } },
  method: { type: String },
  cashRegisterId: { type: Schema.Types.ObjectId, ref: 'CashRegister', required: true },
  note: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  locked: { type: Boolean, default: false },
  locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
}, { timestamps: true });

// Virtual getter: signedAmount
PaymentSchema.virtual('signedAmount').get(function signedAmount() {
  const amt = this.amount || 0;
  if (this.type === 'income') return amt;
  if (this.type === 'expense') return -amt;
  if (this.type === 'refund') return -amt;
  return amt;
});

// Minimal pre-validate checks
PaymentSchema.pre('validate', function(next) {
  if (!Array.isArray(this.articlePath) || this.articlePath.length < 1) {
    return next(new Error('ARTICLE_PATH_REQUIRED'));
  }
  if (!(this.amount > 0)) {
    return next(new Error('AMOUNT_MUST_BE_POSITIVE'));
  }
  return next();
});

// Indexes
PaymentSchema.index({ cashRegisterId: 1 });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ type: 1 });
PaymentSchema.index({ createdAt: 1 });
PaymentSchema.index({ locationId: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);