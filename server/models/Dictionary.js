const mongoose = require('mongoose');

const { Schema } = mongoose;

const DictionarySchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  values: { type: [Schema.Types.Mixed], default: [] },
  updatedAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
});

// Unique index on code
DictionarySchema.index({ code: 1 }, { unique: true });

// Normalize code and touch updatedAt on each save
DictionarySchema.pre('validate', function preValidate(next) {
  if (typeof this.code === 'string') {
    this.code = this.code.trim().toLowerCase();
  }
  next();
});

DictionarySchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Dictionary', DictionarySchema);