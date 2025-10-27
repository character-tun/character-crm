const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { requireStocksEnabled } = require('../middleware/featureFlags/stock');
const { validate } = require('../middleware/validate');
const { adjustSchema, transferSchema } = require('../validation/stock');
const stockService = require('../services/stock/stockService');

router.use(requireStocksEnabled);
router.use(requireAuth);

// GET /api/stocks — list balances by filters
router.get('/', requirePermission('stocks.read'), async (req, res) => {
  try {
    const { itemId, locationId } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const result = await stockService.listBalances({ itemId, locationId, limit, offset });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// POST /api/stocks/adjust — manual adjustment (+/-)
router.post('/adjust', requirePermission('stocks.adjust'), validate(adjustSchema), async (req, res) => {
  try {
    const { itemId, locationId, qty, note } = req.body;
    const result = await stockService.adjust({ itemId, locationId, qty, note, userId: req.user && req.user._id });
    res.json(result);
  } catch (err) {
    const code = err.statusCode === 409 ? 409 : (err.statusCode || 500);
    res.status(code).json({ ok: false, error: err.message });
  }
});

// POST /api/stocks/transfer — move stock between locations
router.post('/transfer', requirePermission('stocks.transfer'), validate(transferSchema), async (req, res) => {
  try {
    const { itemId, from, to, qty, note } = req.body;
    const result = await stockService.transfer({ itemId, from, to, qty, note, userId: req.user && req.user._id });
    res.json(result);
  } catch (err) {
    const code = err.statusCode === 409 ? 409 : (err.statusCode || 500);
    res.status(code).json({ ok: false, error: err.message });
  }
});

module.exports = router;