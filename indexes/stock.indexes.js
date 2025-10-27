#!/usr/bin/env node
/* eslint-disable no-console */
const connectDB = require('../config/db');

async function main() {
  const start = Date.now();
  await connectDB();

  const StockBalance = require('../models/stock/StockBalance'); // StockBalanceArch
  const StockOperation = require('../models/stock/StockOperation');

  try {
    await StockBalance.syncIndexes();
    await StockOperation.syncIndexes();
    const duration = Date.now() - start;
    console.log('[stock.indexes] OK: indexes synced for StockBalanceArch + StockOperation');
    console.log(`[stock.indexes] duration=${duration}ms`);
    process.exit(0);
  } catch (err) {
    console.error('[stock.indexes] ERROR:', err && err.message);
    process.exit(1);
  }
}

main();
