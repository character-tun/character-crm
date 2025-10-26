const express = require('express');
const mongoose = require('mongoose');
const { requireRoles } = require('../middleware/auth');

let PayrollAccrual; try { PayrollAccrual = require('../server/models/PayrollAccrual'); } catch (e) {}
let PayrollRule; try { PayrollRule = require('../server/models/PayrollRule'); } catch (e) {}

const router = express.Router();
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const mongoReady = () => !!(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);

// DEV store
let devStore; try { devStore = require('../services/devPayrollStore'); } catch (_) {}

// GET /api/payroll/accruals — list
router.get('/accruals', requireRoles('Admin', 'Manager', 'Finance'), async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  if (DEV_MODE && !mongoReady()) {
    const items = devStore ? devStore.getItems().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(offset, offset + limit) : [];
    return res.json({ ok: true, items });
  }

  if (!PayrollAccrual) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    const items = await PayrollAccrual.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit)
      .lean();
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/payroll/accruals — manual create
router.post('/accruals', requireRoles('Admin', 'Manager'), async (req, res) => {
  const body = req.body || {};
  const toId = (v) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : undefined);
  const payload = {
    orderId: toId(body.orderId),
    employeeId: toId(body.employeeId),
    amount: Number(body.amount || 0),
    percent: body.percent !== undefined ? Number(body.percent) : undefined,
    baseAmount: body.baseAmount !== undefined ? Number(body.baseAmount) : undefined,
    ruleId: toId(body.ruleId),
    status: body.status ? String(body.status) : 'new',
    note: body.note ? String(body.note) : undefined,
    createdBy: toId(req.user && req.user.id),
  };

  if (DEV_MODE && !mongoReady()) {
    if (!devStore) return res.status(503).json({ error: 'DEV_STORE_NOT_AVAILABLE' });
    const id = devStore.nextId();
    devStore.pushItem({ _id: id, ...payload });
    return res.status(201).json({ ok: true, id });
  }

  if (!PayrollAccrual) return res.status(503).json({ error: 'MODEL_NOT_AVAILABLE' });
  try {
    if (!(payload.amount > 0)) return res.status(400).json({ error: 'AMOUNT_REQUIRED' });
    const created = await PayrollAccrual.create(payload);
    return res.status(201).json({ ok: true, id: created._id });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;