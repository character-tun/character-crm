#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const FieldSchema = require('../server/models/FieldSchema');

const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';

const SEED = [
  {
    scope: 'orders',
    name: 'Форма заказа',
    fields: [
      { code: 'client_name', type: 'text', label: 'Клиент', required: true },
      { code: 'order_date', type: 'date', label: 'Дата заказа', required: true },
      { code: 'service', type: 'list', label: 'Услуга', required: true, options: ['Полировка', 'Химчистка', 'Оклейка'] },
      { code: 'extras', type: 'multilist', label: 'Доп. опции', options: ['Нанокерамика', 'Антидождь', 'Защита салона'] },
      { code: 'prepaid', type: 'number', label: 'Предоплата' },
      { code: 'is_urgent', type: 'bool', label: 'Срочно?' },
    ],
    note: 'Базовая форма заказа (seed)',
  },
  {
    scope: 'clients',
    name: 'Форма клиента',
    fields: [
      { code: 'first_name', type: 'text', label: 'Имя', required: true },
      { code: 'last_name', type: 'text', label: 'Фамилия' },
      { code: 'phone', type: 'text', label: 'Телефон', required: true },
      { code: 'email', type: 'text', label: 'Email' },
      { code: 'preferred_contact', type: 'list', label: 'Предпочтительный контакт', options: ['Телефон', 'Email', 'Telegram'] },
      { code: 'tags', type: 'multilist', label: 'Теги', options: ['VIP', 'Постоянный', 'Новый'] },
    ],
    note: 'Базовая форма клиента (seed)',
  },
];

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    let created = 0;
    let adjustedPairs = 0;

    for (const entry of SEED) {
      const { scope, name, fields, note } = entry;
      const existing = await FieldSchema.find({ scope, name }).sort({ version: -1 }).lean();

      if (!existing || existing.length === 0) {
        await FieldSchema.create({ scope, name, fields, note, version: 1, isActive: true });
        created += 1;
        console.log(`Создана схема: ${scope}/${name} v1 (active)`);
        continue;
      }

      const active = existing.filter((x) => x.isActive);
      if (active.length === 1) {
        // OK, ничего не делаем
        continue;
      }

      // Если нет активной или активных несколько — оставляем активной самую свежую, остальные выключаем
      adjustedPairs += 1;
      const keepActiveId = existing[0]._id; // самый новый (version DESC)
      await FieldSchema.updateMany({ scope, name, _id: { $ne: keepActiveId } }, { $set: { isActive: false } });
      await FieldSchema.updateOne({ _id: keepActiveId }, { $set: { isActive: true } });
      console.log(`Исправлена активность для пары ${scope}/${name}: активна версия ${existing[0].version}`);
    }

    try { await mongoose.connection.close(); } catch {}
    console.log(`Готово. Создано пар: ${created}. Исправлено пар активности: ${adjustedPairs}.`);
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedFieldSchemas:', err && err.message ? err.message : err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();
