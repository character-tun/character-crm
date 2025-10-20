#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const OrderStatus = require('../models/OrderStatus');
const OrderType = require('../server/models/OrderType');

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    // Находим статус из группы draft (первый по порядку), запасной вариант — code: 'new'
    let draft = await OrderStatus.findOne({ group: 'draft' }).sort({ order: 1 }).lean();
    if (!draft) {
      draft = await OrderStatus.findOne({ code: 'new' }).lean();
    }

    if (!draft) {
      console.error('Не найден статус черновика. Сначала выполните: npm run seed:orderStatuses');
      process.exit(1);
    }

    const payload = {
      name: 'Default',
      isSystem: true,
      startStatusId: draft._id,
      allowedStatuses: [draft._id],
    };

    const res = await OrderType.updateOne(
      { code: 'default' },
      {
        $set: payload,
        $setOnInsert: { code: 'default', createdAt: new Date() },
      },
      { upsert: true, runValidators: true }
    );

    const created = res.upsertedCount && res.upsertedCount > 0;
    console.log(`OrderType 'default' ${created ? 'создан' : 'обновлён'}; startStatusId=${draft._id}`);
    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedOrderTypes:', err.message || err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();