#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const csvParse = require('csv-parse/sync');
const mongoose = require('mongoose');
const connectDB = require('../../config/db');

async function loadCsvIfExists() {
  const candidates = [
    path.join(process.cwd(), 'storage', 'import', 'Склад.csv'),
    path.join(process.cwd(), 'storage', 'import', 'stock.csv'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const rows = csvParse.parse(buf, {
        columns: true,
        skip_empty_lines: true,
      });
      return rows; // Expect columns: itemCode|itemId, locationId, quantity, reservedQuantity
    }
  }
  return null;
}

async function main() {
  const start = Date.now();
  await connectDB();

  const StockBalance = require('../../models/stock/StockBalance'); // StockBalanceArch
  const StockOperation = require('../../models/stock/StockOperation');
  let processed = 0; let totalQty = 0;

  try {
    const csvRows = await loadCsvIfExists();
    if (csvRows && csvRows.length) {
      for (const r of csvRows) {
        const itemId = r.itemId ? mongoose.Types.ObjectId(r.itemId) : undefined;
        const locationId = r.locationId ? mongoose.Types.ObjectId(r.locationId) : undefined;
        if (!itemId || !locationId) continue;
        const quantity = Number(r.quantity || 0);
        const reservedQuantity = Number(r.reservedQuantity || 0);
        await StockBalance.updateOne(
          { itemId, locationId },
          { $set: { quantity, reservedQuantity, lastUpdatedAt: new Date() } },
          { upsert: true }
        );
        processed += 1; totalQty += quantity;
      }
    } else {
      // Fallback: derive from existing StockItem and StockMovement if present
      let StockItem; let StockMovement;
      try { StockItem = require('../../server/models/StockItem'); } catch (e) {}
      try { StockMovement = require('../../server/models/StockMovement'); } catch (e) {}

      if (StockItem) {
        const items = await StockItem.find({}).lean();
        for (const it of items) {
          const itemId = it.itemId || it._id; // prefer itemId if denormalized
          const locationId = it.locationId || undefined;
          const quantity = Number(it.qtyOnHand || 0);
          const reservedQuantity = 0;
          if (!itemId) continue;
          if (!locationId) continue; // enforce location pairing for unique index
          await StockBalance.updateOne(
            { itemId, locationId },
            { $set: { quantity, reservedQuantity, lastUpdatedAt: new Date() } },
            { upsert: true }
          );
          processed += 1; totalQty += quantity;
        }
      }

    }

    const duration = Date.now() - start;
    console.log(`[stocks.backfill] processed=${processed} totalQty=${totalQty} duration=${duration}ms`);
    process.exit(0);
  } catch (err) {
    console.error('[stocks.backfill] ERROR:', err && err.message);
    process.exit(1);
  }
}

main();