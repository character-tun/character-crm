const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrderTypeSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },

  startStatusId: { type: Schema.Types.ObjectId, ref: 'OrderStatus' },
  allowedStatuses: [{ type: Schema.Types.ObjectId, ref: 'OrderStatus' }],

  fieldsSchemaId: { type: Schema.Types.ObjectId, ref: 'FieldSchema' },
  docTemplateIds: [{ type: Schema.Types.ObjectId, ref: 'DocTemplate' }],

  isSystem: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
});

// Explicit unique index for clarity and robustness
OrderTypeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('OrderType', OrderTypeSchema);