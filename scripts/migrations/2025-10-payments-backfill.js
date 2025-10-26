#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../../server/models/Payment');

(async () => {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  const DEFAULT_LOCATION_ID = process.env.DEFAULT_LOCATION_ID || null;

  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    let normalizedCount = 0;
    let skippedAlreadyNormalized = 0;

    // Normalize articlePath: strings -> [string], ensure array of strings
    const cursor = Payment.find({
      $or: [
        { articlePath: { $type: 'string' } },
        { articlePath: { $exists: false } },
        { articlePath: { $type: 'array' } },
      ],
    }).cursor();

    for await (const p of cursor) {
      let needsUpdate = false;
      let newArticlePath = p.articlePath;

      if (typeof p.articlePath === 'string') {
        newArticlePath = [p.articlePath].filter(Boolean);
        needsUpdate = true;
      } else if (Array.isArray(p.articlePath)) {
        const cleaned = (p.articlePath || []).filter((v) => v != null && v !== '').map((v) => String(v));
        if (JSON.stringify(cleaned) !== JSON.stringify(p.articlePath)) {
          newArticlePath = cleaned;
          needsUpdate = true;
        }
      } else if (p.articlePath == null) {
        newArticlePath = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Payment.updateOne({ _id: p._id }, { $set: { articlePath: newArticlePath } });
        normalizedCount += 1;
      } else {
        skippedAlreadyNormalized += 1;
      }
    }

    // Backfill locationId only if a default is provided
    let backfilledLocation = 0;
    if (DEFAULT_LOCATION_ID) {
      const res = await Payment.updateMany(
        { $or: [{ locationId: { $exists: false } }, { locationId: null }, { locationId: '' }] },
        { $set: { locationId: DEFAULT_LOCATION_ID } },
      );
      backfilledLocation = res.modifiedCount || res.nModified || 0;
    } else {
      console.log('DEFAULT_LOCATION_ID не задан — пропускаю заполнение locationId.');
    }

    console.log(`Нормализовано articlePath: ${normalizedCount}`);
    console.log(`Пропущено уже нормализованных: ${skippedAlreadyNormalized}`);
    if (DEFAULT_LOCATION_ID) {
      console.log(`Заполнено locationId по умолчанию (${DEFAULT_LOCATION_ID}): ${backfilledLocation}`);
    }

    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  } catch (err) {
    console.error('Ошибка миграции payments-backfill:', err && err.message ? err.message : err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();
