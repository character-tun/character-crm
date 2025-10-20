const path = require('path');

/**
 * isStatusInOrderTypes
 * Hook for future check (planned in v3.2): prevents deletion
 * if there exists OrderType.startStatusCode === code.
 * If OrderType model is not yet available, returns false.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
async function isStatusInOrderTypes(code) {
  if (!code) return false;
  try {
    // Try to require OrderType model dynamically
    const OrderType = require(path.join('..', 'models', 'OrderType'));
    if (!OrderType || !OrderType.exists) return false;
    const exists = await OrderType.exists({ startStatusCode: code });
    return !!exists;
  } catch (err) {
    // If model isn't present yet, or any error occurs, treat as not in types
    if (err && (err.code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(String(err)))) {
      return false;
    }
    // Log unexpected errors but do not block deletion flow
    console.warn('[statusDeletionGuard] OrderType check error:', err && err.message ? err.message : err);
    return false;
  }
}

module.exports = { isStatusInOrderTypes };