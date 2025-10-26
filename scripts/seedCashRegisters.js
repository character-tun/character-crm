#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const CashRegister = require('../server/models/CashRegister');

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const res = await CashRegister.updateOne(
      { code: 'main' },
      {
        $setOnInsert: {
          code: 'main',
          name: 'Основная касса',
          isSystem: true,
          cashierMode: 'open',
          defaultForLocation: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, runValidators: true },
    );

    // Fetch the register to show its id/code
    const reg = await CashRegister.findOne({ code: 'main' }).lean();
    const created = !!(res.upsertedCount || (res.upserted && res.upserted.length));
    console.log(
      created
        ? `Создана системная касса: code=main, name="${reg && reg.name ? reg.name : 'Основная касса'}", id=${reg && reg._id ? reg._id : 'unknown'}`
        : `Касса уже существует: code=main, id=${reg && reg._id ? reg._id : 'unknown'}`,
    );

    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedCashRegisters:', err && err.message ? err.message : err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();
