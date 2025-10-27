const express = require('express');
const { requireAuth, requirePermission } = require('../../middleware/auth');
const { requireStocksEnabled } = require('../../middleware/featureFlags/stock');
const service = require('../../services/reports/stocksReportService');

const router = express.Router();

router.use(requireStocksEnabled);
router.use(requireAuth);

// GET /api/reports/stocks/summary?by=location&limit=
router.get('/summary', requirePermission('warehouse.read'), async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 10));
    const result = await service.summaryByLocation({ limit });
    return res.json(result);
  } catch (err) { return next(err); }
});

// GET /api/reports/stocks/turnover?from=&to=&limit=
router.get('/turnover', requirePermission('warehouse.read'), async (req, res, next) => {
  try {
    const { from, to } = req.query || {};
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 10));
    const result = await service.turnover({ from, to, limit });
    return res.json(result);
  } catch (err) { return next(err); }
});

module.exports = router;