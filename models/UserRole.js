const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UserRoleSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  user_id: { type: String, ref: 'User', required: true },
  role_id: { type: String, ref: 'Role', required: true },
  createdAt: { type: Date, default: Date.now },
});

UserRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });

module.exports = mongoose.model('UserRole', UserRoleSchema);
