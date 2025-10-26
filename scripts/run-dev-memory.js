/*
 * Start server with an in-memory MongoDB for quick local checks.
 * - Uses mongodb-memory-server
 * - Enables AUTH_DEV_MODE (DEV auth and in‑memory Bull queue)
 * - Pre-connects Mongoose so server.js skips connectDB but models are ready
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Pre-connect mongoose before requiring server.js
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`[run-dev-memory] MongoMemoryServer started: ${uri}`);

  // Minimal env for dev auth and dry-runs
  process.env.AUTH_DEV_MODE = '1';
  process.env.AUTH_DEV_EMAIL = process.env.AUTH_DEV_EMAIL || 'admin@localhost';
  process.env.AUTH_DEV_PASSWORD = process.env.AUTH_DEV_PASSWORD || 'admin';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-memory-secret';
  process.env.NOTIFY_DRY_RUN = process.env.NOTIFY_DRY_RUN || '1';
  process.env.PRINT_DRY_RUN = process.env.PRINT_DRY_RUN || '1';
  process.env.PORT = process.env.PORT || '5002';

  // Prefer in-memory queue (no Redis)
  if (!process.env.REDIS_URL) {
    console.log('[run-dev-memory] Using in-memory queue for status actions');
  }

  // Start server
  require('../server');

  const shutdown = async () => {
    try {
      await mongoose.disconnect();
    } catch (e) {
      console.warn('[run-dev-memory] mongoose disconnect error:', e && e.message);
    }
    try {
      await mongod.stop();
    } catch (e) {
      console.warn('[run-dev-memory] mongod stop error:', e && e.message);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
