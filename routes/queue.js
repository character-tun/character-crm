const express = require('express');

const router = express.Router();
const { requireRoles } = require('../middleware/auth');
const { getStatusActionsMetrics } = require('../services/queueMetrics');

// GET /api/queue/status-actions/metrics
router.get('/status-actions/metrics', requireRoles('settings.queue:read', 'Admin'), async (req, res) => {
  try {
    const n = Math.max(1, parseInt(req.query.n || '20', 10) || 20);
    const threshold = parseInt(process.env.QUEUE_FAIL_THRESHOLD || '10', 10);
    const metrics = await getStatusActionsMetrics(n);

    if (metrics.failedLastHour > threshold) {
      console.warn('[QUEUE][WARNING] failed jobs in last hour exceeded threshold', {
        failedLastHour: metrics.failedLastHour,
        threshold,
      });
    }

    res.json(metrics);
  } catch (err) {
    console.error('[queue][metrics] error', err);
    res.status(500).json({ msg: 'Metrics fetch error' });
  }
});

module.exports = router;