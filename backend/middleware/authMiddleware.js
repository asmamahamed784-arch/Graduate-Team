import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { isActiveAccountStatus, normalizeAccountStatus, normalizeUserRole } from '../utils/rbac.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from the token
      req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      req.user = await normalizeUserRole(req.user);

      if (['operator', 'super_operator', 'center_manager'].includes(req.user.role) && !isActiveAccountStatus(req.user.status)) {
        const accountStatus = normalizeAccountStatus(req.user.status);
        const message = accountStatus === 'pending_approval'
          ? 'This operator account is pending Super Admin approval.'
          : accountStatus === 'rejected'
            ? 'This operator account was rejected by the Super Admin.'
            : 'This operator account is inactive.';
        return res.status(403).json({ success: false, message });
      }
      if (['operator', 'super_operator', 'center_manager'].includes(req.user.role) && !req.user.center) {
        return res.status(403).json({ success: false, message: 'This operator account is not assigned to a service center.' });
      }

      if (req.user.mustChangePassword) {
        const allowedPasswordRoutes = [
          '/api/auth/profile',
          '/api/auth/password',
          '/api/auth/logout'
        ];
        const canProceed = allowedPasswordRoutes.some((route) => req.originalUrl.startsWith(route));
        if (!canProceed) {
          return res.status(403).json({
            success: false,
            message: 'Password change required. Please update your temporary password before continuing.'
          });
        }
      }

      req.tokenId = decoded.jti || null;

      if (decoded.jti) {
        const session = await prisma.activeSession.findUnique({ where: { tokenId: decoded.jti } });
        if (session && session.status !== 'active') {
          return res.status(401).json({ success: false, message: 'This session has been signed out.' });
        }
      }

      const now = new Date();
      await prisma.user.update({
        where: { id: req.user.id },
        data: { lastActiveAt: now }
      });
      await prisma.accountProfile.updateMany({
        where: { userId: req.user.id },
        data: { lastActiveAt: now }
      });

      if (decoded.jti) {
        await prisma.activeSession.updateMany({
          where: { tokenId: decoded.jti, status: 'active' },
          data: { lastActiveTime: now }
        });
      }
      
      return next();
    } catch (error) {
      console.error('Token validation failed:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

export const optionalProtect = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    return next();
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (req.user) {
      req.user = await normalizeUserRole(req.user);
    }
    req.tokenId = decoded.jti || null;
  } catch (_error) {
    req.user = null;
  }

  return next();
};
