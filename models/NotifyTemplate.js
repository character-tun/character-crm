const mongoose = require('mongoose');

const NotifyTemplateSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  channel: { type: String, default: 'email' },
  subject: { type: String, required: true },
  bodyHtml: { type: String, required: true },
  variables: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

NotifyTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('NotifyTemplate', NotifyTemplateSchema);
