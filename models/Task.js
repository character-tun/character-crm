const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ChecklistItemSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4 },
  text: { type: String, default: '' },
  done: { type: Boolean, default: false }
}, { _id: false });

const ActivitySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  type: { type: String, default: 'update' },
  message: { type: String, default: '' },
  user: { type: String, default: '' }
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  title: { type: String, required: true },
  status: { type: String, enum: ['Назначено','В работе','Проверка','Готово'], default: 'Назначено' },
  priority: { type: String, enum: ['Низкий','Средний','Высокий','Критический'], default: 'Средний' },
  deadline: { type: String },
  assignee: { type: String },
  orderId: { type: String },
  workOrderId: { type: String },
  tags: [{ type: String }],
  checklist: [ChecklistItemSchema],
  order: { type: Number, default: 0 },
  activity: [ActivitySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TaskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Task', TaskSchema);