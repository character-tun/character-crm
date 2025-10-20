const jwt = require('jsonwebtoken');

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
  next();
};

const requireAuth = (req, res, next) => {
  const u = req.user;
  if (!u || !u.id) {
    return res.status(401).json({ msg: 'Необходима авторизация' });
  }
  next();
};

const requireRoles = (...roles) => (req, res, next) => {
  const u = req.user || {};
  const required = new Set(roles);
  const hasArray = Array.isArray(u.roles) && u.roles.some((r) => required.has(r));
  const hasSingle = u.role && required.has(u.role);
  if (!hasArray && !hasSingle) {
    return res.status(403).json({ msg: 'Недостаточно прав' });
  }
  next();
};

// Single-role guard convenience wrapper
const requireRole = (role) => (req, res, next) => requireRoles(role)(req, res, next);

// Any-of list convenience wrapper (accepts array)
const requireAnyRole = (roles) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => requireRoles(...list)(req, res, next);
};

// RBAC permissions map (resource.action -> allowed roles)
const RBAC_MAP = {
  'orderTypes.read': ['Admin'],
  'orderTypes.write': ['Admin'],
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

module.exports = {
  withUser, requireAuth, requireRoles, requireRole, requireAnyRole,
  RBAC_MAP, hasPermission, requirePermission,
};