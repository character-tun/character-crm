const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'SERVER_ERROR';
  const payload = { ok: false, error: message };
  if (err.details && Array.isArray(err.details)) {
    payload.details = err.details;
  }
  res.status(status).json(payload);
};

module.exports = errorHandler;
