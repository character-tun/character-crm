const jwt = require('jsonwebtoken');
// Lazy-load UserToken inside functions to avoid mongoose compile during tests

const withUser = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const secret = process.env.JWT_SECRET || 'dev_secret';
  let user = null;

  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      user = jwt.verify(token, secret);
    } catch (e) {
      user = null; // invalid or expired token
    }
  }

  if (!user) {
    const id = req.headers['x-user-id'] || '';
    const role = req.headers['x-user-role'] || '';
    const email = req.headers['x-user-email'] || '';
    const name = req.headers['x-user-name'] || '';
    const roles = role ? [role] : [];
    user = {
      id, email, role: role || null, roles, name: name || id || '',
    };
  }

  req.user = user;
  return next();
};

const requireAuth = (req, res, next) => {
  const u = req.user;
  if (!u || !u.id) {
    return res.status(401).json({ msg: 'Необходима авторизация' });
  }
  return next();
};

// RBAC permissions map (resource.action -> allowed roles)
const RBAC_MAP = {
  'orderTypes.read': ['Admin', 'Manager'],
  'orderTypes.write': ['Admin'],
  'uiTheme.read': ['Admin', 'Manager'],
  'uiTheme.write': ['Admin'],

  'payments.read': ['Admin', 'Finance'],
  'payments.write': ['Admin', 'Finance'],
  'payments.lock': ['Admin', 'Finance'],
  'cash.read': ['Admin', 'Finance'],
  'cash.write': ['Admin'],
};

const requireRoles = (...roles) => (req, res, next) => {
  const u = req.user || {};
  const required = new Set(roles);
  const hasArray = Array.isArray(u.roles) && u.roles.some((r) => required.has(r));
  const hasSingle = u.role && required.has(u.role);
  if (!hasArray && !hasSingle) {
    return res.status(403).json({ msg: 'Недостаточно прав' });
  }
  return next();
};

// Single-role guard convenience wrapper
const requireRole = (role) => (req, res, next) => requireRoles(role)(req, res, next);

// Any-of list convenience wrapper (accepts array)
const requireAnyRole = (roles) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => requireRoles(...list)(req, res, next);
};

const userHasAnyRole = (user, roles) => {
  const u = user || {};
  const required = new Set(roles || []);
  const hasArray = Array.isArray(u.roles) && u.roles.some((r) => required.has(r));
  const hasSingle = u.role && required.has(u.role);
  return !!(hasArray || hasSingle);
};

const hasPermission = (reqOrUser, permission) => {
  const u = reqOrUser && reqOrUser.user ? reqOrUser.user : reqOrUser;
  const roles = RBAC_MAP[permission] || [];
  if (!roles.length) return false; // unknown permission => deny
  return userHasAnyRole(u, roles);
};

const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req, permission)) {
    return res.status(403).json({ msg: 'Недостаточно прав' });
  }
  return next();
};

const signToken = async (user) => {
  const payload = { id: user.id, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
  return token;
};

const verifyToken = async (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (e) {
    return null;
  }
};

// Revoke all refresh tokens for a user (use on password reset)
const revokeAll = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const UserToken = require('../models/UserToken');
  const res = await UserToken.deleteMany({ user_id: userId });
  return { ok: true, deletedCount: (res && res.deletedCount) || 0 };
};

module.exports = {
  withUser,
  requireAuth,
  requireRoles,
  requireRole,
  requireAnyRole,
  RBAC_MAP,
  hasPermission,
  requirePermission,
  signToken,
  verifyToken,
  revokeAll,
};
