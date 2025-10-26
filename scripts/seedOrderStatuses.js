#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const OrderStatus = require('../models/OrderStatus');

const STATUSES = [
  { code: 'new', name: 'Новый', color: '#3894ff', group: 'draft', order: 10, system: true, actions: [] },
  { code: 'in_work', name: 'В работе', color: '#ffaa00', group: 'in_progress', order: 20, system: false, actions: [] },
  { code: 'ready', name: 'Готов', color: '#8e8e93', group: 'in_progress', order: 30, system: false, actions: [] },
  { code: 'closed_paid', name: 'Закрыт (оплачен)', color: '#35c759', group: 'closed_success', order: 40, system: true, actions: [{ type: 'payrollAccrual' }] },
  { code: 'closed_unpaid', name: 'Закрыт (без оплаты)', color: '#ff3b30', group: 'closed_fail', order: 50, system: true, actions: [{ type: 'closeWithoutPayment' }] },
];

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    let upserts = 0;
    for (const s of STATUSES) {
      const payload = {
        name: s.name,
        color: s.color,
        group: s.group,
        order: s.order,
        system: !!s.system,
        actions: s.actions || [],
        updatedAt: new Date(),
      };
      const res = await OrderStatus.updateOne(
        { code: s.code },
        {
          $set: payload,
          $setOnInsert: { _id: uuidv4(), code: s.code, createdAt: new Date() },
        },
        { upsert: true, runValidators: true },
      );
      if (res.upsertedCount || (res.upserted && res.upserted.length)) upserts += 1;
    }
    console.log(`Статусы заказов инициализированы. Создано новых: ${upserts}, всего обработано: ${STATUSES.length}`);
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedOrderStatuses:', err.message);
    process.exit(1);
  }
})();
