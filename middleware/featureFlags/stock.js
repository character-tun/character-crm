// Middleware guard for stock-related routes based on ENABLE_STOCKS flag
module.exports.requireStocksEnabled = function requireStocksEnabled(req, res, next) {
  const v = String(process.env.ENABLE_STOCKS || '1').toLowerCase();
  const enabled = v === '1' || v === 'true';
  if (!enabled) return res.status(404).json({ ok: false, error: 'STOCKS_DISABLED' });
  return next();
};