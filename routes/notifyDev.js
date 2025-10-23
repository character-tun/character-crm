const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
// GET /api/notify/dev/outbox — disabled
router.get('/outbox', requireRole('Admin'), (req, res) => {
  res.status(404).json({ error: 'NOT_AVAILABLE' });
});

module.exports = router;