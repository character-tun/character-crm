const mongoose = require('mongoose');

const CashRegisterSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  defaultForLocation: { type: Boolean, default: false },
  cashierMode: { type: String, enum: ['open', 'strict'], default: 'open' },
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

// Unique index for code
CashRegisterSchema.index({ code: 1 }, { unique: true });

// Guard: prohibit deleting cash register if it has payments
CashRegisterSchema.pre('deleteOne', { document: false, query: true }, async function(next) {
  try {
    const filter = this.getFilter() || {};
    const id = filter._id || filter.id;
    if (!id) return next();
    const Payment = mongoose.models.Payment || require('./Payment');
    const cnt = await Payment.countDocuments({ cashRegisterId: id });
    if (cnt > 0) return next(new Error('CASH_REGISTER_HAS_PAYMENTS'));
    return next();
  } catch (err) {
    return next(err);
  }
});

CashRegisterSchema.pre('findOneAndDelete', async function(next) {
  try {
    const filter = this.getFilter() || {};
    const id = filter._id || filter.id;
    if (!id) return next();
    const Payment = mongoose.models.Payment || require('./Payment');
    const cnt = await Payment.countDocuments({ cashRegisterId: id });
    if (cnt > 0) return next(new Error('CASH_REGISTER_HAS_PAYMENTS'));
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model('CashRegister', CashRegisterSchema);