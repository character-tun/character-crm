const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_CODES = ['Admin', 'Manager', 'Production', 'Detailing', 'Finance'];

const RoleSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  code: {
    type: String, required: true, unique: true, enum: ALLOWED_CODES,
  },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RoleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Role', RoleSchema);
module.exports.ALLOWED_CODES = ALLOWED_CODES;
