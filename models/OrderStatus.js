const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ACTION_TYPES = ['charge','closeWithoutPayment','payrollAccrual','notify','print'];
const CHANNELS = ['sms','email','telegram'];
const GROUPS = ['draft','in_progress','closed_success','closed_fail'];

const ActionSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ACTION_TYPES },
  templateId: { type: String },
  channel: { type: String, enum: CHANNELS },
  docId: { type: String }
}, { _id: false });

const OrderStatusSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  code: { type: String, required: true, unique: true, match: /^[a-z0-9_-]{2,40}$/ },
  name: { type: String, required: true },
  color: { type: String },
  group: { type: String, required: true, enum: GROUPS },
  order: { type: Number, default: 0 },
  actions: { type: [ActionSchema], default: [] },
  system: { type: Boolean, default: false },
  locationId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for sorting within group
OrderStatusSchema.index({ group: 1, order: 1 });

// Update updatedAt on save
OrderStatusSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // If system=true, prevent changes to code/group on existing docs
  if (!this.isNew && this.system) {
    if (this.isModified('code') || this.isModified('group')) {
      return next(new Error('System status: code/group cannot be modified'));
    }
  }
  next();
});

// Prevent changing code/group via findOneAndUpdate when system=true
OrderStatusSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || {};
    const newCode = (update.code !== undefined) ? update.code : $set.code;
    const newGroup = (update.group !== undefined) ? update.group : $set.group;

    if (newCode === undefined && newGroup === undefined) {
      return next();
    }

    const doc = await this.model.findOne(this.getQuery()).lean();
    if (doc && doc.system) {
      if (newCode !== undefined && newCode !== doc.code) {
        return next(new Error('System status: code cannot be modified'));
      }
      if (newGroup !== undefined && newGroup !== doc.group) {
        return next(new Error('System status: group cannot be modified'));
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Prevent deletion of system status via query-based deletions
OrderStatusSchema.pre('findOneAndDelete', async function(next) {
  try {
    const doc = await this.model.findOne(this.getQuery()).lean();
    if (doc && doc.system) {
      return next(new Error('System status: cannot be deleted'));
    }
    next();
  } catch (err) {
    next(err);
  }
});

OrderStatusSchema.pre('deleteOne', { query: true }, async function(next) {
  try {
    const doc = await this.model.findOne(this.getFilter()).lean();
    if (doc && doc.system) {
      return next(new Error('System status: cannot be deleted'));
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Prevent deletion of system status via document.deleteOne()
OrderStatusSchema.pre('deleteOne', { document: true }, function(next) {
  if (this.system) {
    return next(new Error('System status: cannot be deleted'));
  }
  next();
});

module.exports = mongoose.model('OrderStatus', OrderStatusSchema);
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.CHANNELS = CHANNELS;
module.exports.GROUPS = GROUPS;