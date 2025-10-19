let _access = '';
let _user = null;
let _roles = [];

export const getAccess = () => _access;
export const setAccess = (token) => {
  _access = token || '';
};

export const getUser = () => _user;
export const setUser = (user) => {
  _user = user || null;
  _roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
};

export const getRoles = () => _roles;
export const hasRole = (role) => _roles?.includes(role);
export const hasAnyRole = (roles) => {
  if (!roles || roles.length === 0) return true;
  return roles.some((r) => _roles?.includes(r));
};

export const clearAuth = () => {
  _access = '';
  _user = null;
  _roles = [];
};