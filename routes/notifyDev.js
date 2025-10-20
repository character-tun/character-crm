const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const { getOutbox } = require('../services/statusActionsHandler');

// GET /api/notify/dev/outbox — admin-only, DEV only, with pagination
router.get('/outbox', requireRole('Admin'), (req, res) => {
  if (!DEV_MODE) return res.status(404).json({ error: 'NOT_AVAILABLE' });
  const limit = Math.max(1, parseInt(req.query.limit || '50', 10) || 50);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
  const all = getOutbox ? getOutbox() : [];
  const items = all.slice(offset, offset + limit);
  res.json({ ok: true, total: all.length, items, limit, offset });
});

module.exports = router;