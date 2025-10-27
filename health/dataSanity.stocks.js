#!/usr/bin/env node
/* eslint-disable no-console */
const connectDB = require('../config/db');

async function main() {
  const start = Date.now();
  await connectDB();
  const StockBalance = require('../models/stock/StockBalance'); // StockBalanceArch
  const StockOperation = require('../models/stock/StockOperation');

  try {
    // 1) Базовые негативы: quantity < 0 или reservedQuantity < 0
    const negatives = await StockBalance.find({ $or: [ { quantity: { $lt: 0 } }, { reservedQuantity: { $lt: 0 } } ] }).lean();

    // 2) Доступность: available = quantity - reservedQuantity >= 0
    const negativeAvailable = await StockBalance.aggregate([
      { $addFields: { available: { $subtract: ['$quantity', '$reservedQuantity'] } } },
      { $match: { available: { $lt: 0 } } },
      { $project: { _id: 1, itemId: 1, locationId: 1, quantity: 1, reservedQuantity: 1, available: 1 } },
    ]);

    // 3) Дубли операций: идентичные по ключу (type, itemId, qty, sourceType, sourceId, locationIdFrom, locationIdTo)
    const duplicateOps = await StockOperation.aggregate([
      { $group: {
        _id: {
          type: '$type',
          itemId: '$itemId',
          qty: '$qty',
          sourceType: '$sourceType',
          sourceId: '$sourceId',
          locationIdFrom: '$locationIdFrom',
          locationIdTo: '$locationIdTo',
        },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      } },
      { $match: { count: { $gt: 1 } } },
    ]);

    const duration = Date.now() - start;

    if ((negatives.length > 0) || (negativeAvailable.length > 0) || (duplicateOps.length > 0)) {
      if (negatives.length > 0) {
        console.error(`[stocks.sanity] FAIL: negative quantities found: count=${negatives.length}`);
      }
      if (negativeAvailable.length > 0) {
        console.error(`[stocks.sanity] FAIL: negative available found: count=${negativeAvailable.length}`);
      }
      if (duplicateOps.length > 0) {
        console.error(`[stocks.sanity] FAIL: duplicate stock operations found: groups=${duplicateOps.length}`);
      }
      console.error(`[stocks.sanity] duration=${duration}ms`);
      process.exit(2);
    }

    console.log(`[stocks.sanity] OK: no negatives, available>=0, no duplicate operations; duration=${duration}ms`);
    process.exit(0);
  } catch (err) {
    console.error('[stocks.sanity] ERROR:', err && err.message);
    process.exit(1);
  }
}

main();