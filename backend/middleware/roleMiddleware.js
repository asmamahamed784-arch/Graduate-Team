import { normalizeRole } from '../utils/rbac.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const allowedRoles = roles.map(normalizeRole);

    const expandedRoles = [...allowedRoles];
    if (allowedRoles.includes('operator') && !expandedRoles.includes('super_operator')) {
      expandedRoles.push('super_operator');
    }

    if (!req.user || !expandedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this resource.'
      });
    }
    req.user.role = userRole;
    return next();
  };
};
