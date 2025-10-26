#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const OrderStatusGroupSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  code: { type: String, required: true, unique: true, match: /^[a-z0-9_-]{2,40}$/ },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  system: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'order_status_groups' });

OrderStatusGroupSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const OrderStatusGroup = mongoose.model('OrderStatusGroup', OrderStatusGroupSchema);

const SEED = [
  { code: 'draft', name: 'Черновик', order: 10 },
  { code: 'in_progress', name: 'В работе', order: 20 },
  { code: 'closed_success', name: 'Закрыт (оплачен)', order: 30 },
  { code: 'closed_fail', name: 'Закрыт (без оплаты)', order: 40 },
];

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    let upserts = 0;
    for (const g of SEED) {
      const res = await OrderStatusGroup.updateOne(
        { code: g.code },
        {
          $set: { name: g.name, order: g.order, system: true, updatedAt: new Date() },
          $setOnInsert: { _id: uuidv4(), code: g.code, createdAt: new Date() },
        },
        { upsert: true },
      );
      if (res.upsertedCount || (res.upserted && res.upserted.length)) upserts += 1;
    }
    console.log(`Группы статусов инициализированы. Создано новых: ${upserts}, всего обработано: ${SEED.length}`);
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedStatusGroups:', err.message);
    process.exit(1);
  }
})();
