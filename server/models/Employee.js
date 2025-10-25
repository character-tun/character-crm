const mongoose = require('mongoose');

const { Schema } = mongoose;

const EmployeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  roles: { type: [String], default: [] },
  inn: { type: String },
  locations: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

EmployeeSchema.index({ active: 1 });
EmployeeSchema.index({ userId: 1 }, { sparse: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);