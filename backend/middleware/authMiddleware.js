import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ActiveSession from '../models/ActiveSession.js';
import { normalizeUserRole } from '../utils/rbac.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from the token, exclude password
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      await normalizeUserRole(req.user);

      if (['operator', 'super_operator'].includes(req.user.role) && req.user.status !== 'active') {
        return res.status(403).json({ success: false, message: 'This operator account is inactive.' });
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
        const session = await ActiveSession.findOne({ tokenId: decoded.jti });
        if (session && session.status !== 'active') {
          return res.status(401).json({ success: false, message: 'This session has been signed out.' });
        }
      }

      req.user.lastActiveAt = new Date();
      await req.user.save();

      if (decoded.jti) {
        await ActiveSession.findOneAndUpdate(
          { tokenId: decoded.jti, status: 'active' },
          { lastActiveTime: new Date() }
        );
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
    req.user = await User.findById(decoded.id);
    await normalizeUserRole(req.user);
    req.tokenId = decoded.jti || null;
  } catch (_error) {
    req.user = null;
  }

  return next();
};
