const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(30000);

const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');

function runScript(args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const cmd = 'node';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'migrateOrderStatuses.js');
    execFile(cmd, [scriptPath, ...args], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...env },
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        // The script exits with code 0 even on internal errors; we still pass stdout.
        // If execFile itself errors, reject.
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

function latestReportJsonPath() {
  const dir = path.join(__dirname, '..', 'storage', 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('migrateOrderStatuses-') && f.endsWith('.json'));
  if (!files.length) return null;
  const withStats = files.map((f) => {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    return { p, mtime: st.mtimeMs };
  });
  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats[0].p;
}

async function readLatestReport() {
  const p = latestReportJsonPath();
  if (!p) return null;
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw);
}

async function ensureCleanReportsDir() {
  const dir = path.join(__dirname, '..', 'storage', 'reports');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) continue;
      if (f.startsWith('migrateOrderStatuses-') && f.endsWith('.json')) {
        fs.unlinkSync(p);
      }
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

describe('scripts/migrateOrderStatuses.js', () => {
  let mongod;
  let uri;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: 'test-migrate' } });
    uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    try { await mongoose.disconnect(); } catch {}
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await ensureCleanReportsDir();
    // Remove status_map.json if exists
    const mapPath = path.join(__dirname, '..', 'scripts', 'status_map.json');
    if (fs.existsSync(mapPath)) fs.unlinkSync(mapPath);
  });

  test('Idempotency: fills gaps and second run updated=0', async () => {
    // Seed statuses
    await OrderStatus.create([
      { code: 'closed_paid', name: 'Закрыт (оплачен)', group: 'closed_success', order: 40, system: true, actions: [] },
      { code: 'closed_unpaid', name: 'Закрыт (без оплаты)', group: 'closed_fail', order: 50, system: true, actions: [] },
      { code: 'in_work', name: 'В работе', group: 'in_progress', order: 20, system: false, actions: [] },
    ]);

    const createdAtA = new Date('2024-01-01T10:00:00.000Z');
    const createdAtB = new Date('2024-01-02T11:00:00.000Z');
    const createdAtC = new Date('2024-01-03T12:00:00.000Z');

    const orderTypeId = new mongoose.Types.ObjectId();
    const [a, b, c] = await Order.create([
      { orderTypeId, status: 'closed_paid', createdAt: createdAtA },
      { orderTypeId, status: 'closed_unpaid', createdAt: createdAtB },
      { orderTypeId, status: 'in_work', createdAt: createdAtC },
    ]);

    // First run (no-dry-run)
    await runScript(['--no-dry-run'], { MONGO_URI: uri });

    // Reload orders
    const A = await Order.findById(a._id).lean();
    const B = await Order.findById(b._id).lean();
    const C = await Order.findById(c._id).lean();

    // Closed_success: closed set, paymentsLocked untouched, statusChangedAt filled
    expect(A.closed).toBeDefined();
    expect(A.closed.success).toBe(true);
    expect(A.closed.at).toBeDefined();
    expect(new Date(A.closed.at).toISOString()).toBe(createdAtA.toISOString());
    expect(A.paymentsLocked).toBe(false);
    expect(new Date(A.statusChangedAt).toISOString()).toBe(createdAtA.toISOString());

    // Closed_fail: closed set to false and paymentsLocked true; statusChangedAt filled
    expect(B.closed).toBeDefined();
    expect(B.closed.success).toBe(false);
    expect(B.closed.at).toBeDefined();
    expect(new Date(B.closed.at).toISOString()).toBe(createdAtB.toISOString());
    expect(B.paymentsLocked).toBe(true);
    expect(new Date(B.statusChangedAt).toISOString()).toBe(createdAtB.toISOString());

    // In_progress: closed untouched, statusChangedAt filled
    expect(C.closed).toBeUndefined();
    expect(new Date(C.statusChangedAt).toISOString()).toBe(createdAtC.toISOString());

    // Second run should be idempotent (updated: 0)
    await runScript(['--no-dry-run'], { MONGO_URI: uri });
    const report = await readLatestReport();
    expect(report).toBeTruthy();
    expect(report.updated).toBe(0);
  });

  test('Unknown statuses without mapping → reported, no closed/payments changes; with mapping → closed.success=true', async () => {
    // Seed statuses: include a code that matches mapping target
    await OrderStatus.create([
      { code: 'closed_success', name: 'Закрыт (успешно)', group: 'closed_success', order: 41, system: false, actions: [] },
    ]);

    const createdAtX = new Date('2024-02-01T08:00:00.000Z');
    const orderTypeId = new mongoose.Types.ObjectId();
    const x = await Order.create({ orderTypeId, status: 'legacy_closed_ok', createdAt: createdAtX });

    // Run without mapping
    await runScript(['--no-dry-run'], { MONGO_URI: uri });
    let X = await Order.findById(x._id).lean();
    const report1 = await readLatestReport();

    expect(report1).toBeTruthy();
    // Should be reported as unknown
    expect(report1.unknownCount).toBeGreaterThanOrEqual(1);
    expect(report1.unknown.some((u) => String(u.orderId) === String(x._id))).toBe(true);
    // Closed not set; paymentsLocked default false
    expect(X.closed).toBeUndefined();
    expect(X.paymentsLocked).toBe(false);

    // Add mapping
    const mapPath = path.join(__dirname, '..', 'scripts', 'status_map.json');
    fs.writeFileSync(mapPath, JSON.stringify({ legacy_closed_ok: 'closed_success' }));

    // Run again; closed.success should be set
    await runScript(['--no-dry-run'], { MONGO_URI: uri });
    X = await Order.findById(x._id).lean();
    const report2 = await readLatestReport();

    expect(X.closed).toBeDefined();
    expect(X.closed.success).toBe(true);
    expect(new Date(X.closed.at).toISOString()).toBe(new Date(X.statusChangedAt || createdAtX).toISOString());
    // Not reported as unknown anymore in the latest run
    expect(report2.unknown.some((u) => String(u.orderId) === String(x._id))).toBe(false);
  });

  test('Closed-fail sets paymentsLocked=true when closed empty', async () => {
    await OrderStatus.create({ code: 'closed_unpaid', name: 'Закрыт (без оплаты)', group: 'closed_fail', order: 50, system: true, actions: [] });
    const orderTypeId = new mongoose.Types.ObjectId();
    const y = await Order.create({ orderTypeId, status: 'closed_unpaid', createdAt: new Date('2024-03-01T09:00:00.000Z') });

    await runScript(['--no-dry-run'], { MONGO_URI: uri });

    const Y = await Order.findById(y._id).lean();
    expect(Y.closed).toBeDefined();
    expect(Y.closed.success).toBe(false);
    expect(Y.paymentsLocked).toBe(true);
  });
});
