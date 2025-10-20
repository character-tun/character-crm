require('dotenv').config();
const connectDB = require('../config/db');
const Role = require('../models/Role');
const { ALLOWED_CODES } = require('../models/Role');

const NAMES_RU = {
  Admin: 'Администратор',
  Manager: 'Менеджер',
  Production: 'Производство',
  Detailing: 'Детейлинг',
  Finance: 'Финансы',
};

(async () => {
  try {
    await connectDB();
    const codes = ALLOWED_CODES;
    let created = 0;
    for (const code of codes) {
      const name = NAMES_RU[code] || code;
      const res = await Role.updateOne(
        { code },
        { $setOnInsert: { code, name } },
        { upsert: true },
      );
      // When upsert happens, res.upsertedCount is available on newer drivers; fallback check
      if (res.upsertedCount || (res.upserted && res.upserted.length)) {
        created += 1;
      }
    }
    console.log(`Роли инициализированы. Новых: ${created}, всего: ${codes.length}`);
    process.exit(0);
  } catch (err) {
    console.error('Ошибка seedRoles:', err);
    process.exit(1);
  }
})();
