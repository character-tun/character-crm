const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrderTypeSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },

  startStatusId: { type: String, ref: 'OrderStatus' },
  allowedStatuses: [{ type: String, ref: 'OrderStatus' }],

  fieldsSchemaId: { type: Schema.Types.ObjectId, ref: 'FieldSchema' },
  docTemplateIds: [{ type: Schema.Types.ObjectId, ref: 'DocTemplate' }],

  isSystem: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
});

// Explicit unique index for clarity and robustness
OrderTypeSchema.index({ code: 1 }, { unique: true });

// Pre-validate: normalize code and ensure startStatusId ∈ allowedStatuses when provided
OrderTypeSchema.pre('validate', function preValidate(next) {
  if (typeof this.code === 'string') {
    this.code = this.code.trim().toLowerCase();
  }

  if (this.startStatusId) {
    const allowed = Array.isArray(this.allowedStatuses) ? this.allowedStatuses : [];
    const startId = this.startStatusId;
    const included = allowed.some((id) => (id && startId) && String(id) === String(startId));
    if (!included) {
      // Signal Mongoose ValidationError with a specific code
      this.invalidate('startStatusId', 'ORDERTYPE_INVALID_START_STATUS', startId, 'ORDERTYPE_INVALID_START_STATUS');
    }
  }

  next();
});

module.exports = mongoose.model('OrderType', OrderTypeSchema);