const mongoose = require('mongoose');

const { Schema } = mongoose;

const FieldSpecSchema = new Schema({
  code: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'bool', 'list', 'multilist'],
  },
  label: { type: String, trim: true },
  required: { type: Boolean, default: false },
  options: { type: [Schema.Types.Mixed], default: undefined },
  note: { type: String, trim: true },
}, { _id: false });

const FieldSchema = new Schema({
  scope: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  version: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true },
  note: { type: String, trim: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },

  fields: { type: [FieldSpecSchema], default: [] },
}, {
  versionKey: false,
});

// Helpful indexes for querying latest/active schema by scope/name
FieldSchema.index({ scope: 1, name: 1, version: -1 });
FieldSchema.index({ isActive: 1 });

// Validation hook: ensure list/multilist fields have non-empty options
FieldSchema.pre('validate', function preValidate(next) {
  const arr = Array.isArray(this.fields) ? this.fields : [];

  for (let i = 0; i < arr.length; i += 1) {
    const f = arr[i] || {};
    if (f.type === 'list' || f.type === 'multilist') {
      const ok = Array.isArray(f.options) && f.options.length > 0;
      if (!ok) {
        this.invalidate(`fields.${i}.options`, 'FIELD_OPTIONS_REQUIRED');
      }
    }
  }

  // Optional normalization
  if (typeof this.scope === 'string') this.scope = this.scope.trim();
  if (typeof this.name === 'string') this.name = this.name.trim();

  next();
});

module.exports = mongoose.model('FieldSchema', FieldSchema);
