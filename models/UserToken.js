const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UserTokenSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  user_id: { type: String, ref: 'User', required: true },
  refresh_token: { type: String, required: true, unique: true },
  user_agent: { type: String },
  ip: { type: String },
  session_id: { type: String, default: uuidv4 },
  expires_at: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

UserTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserToken', UserTokenSchema);
