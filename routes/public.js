const express = require('express');

const router = express.Router();

// Public, unauthenticated endpoints
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'character-crm', ts: Date.now() });
});

router.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;