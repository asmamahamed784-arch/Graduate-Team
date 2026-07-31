import prisma from '../config/prisma.js';

export const logActivity = async ({
  req = null,
  user = null,
  role = null,
  action,
  details = ''
}) => {
  if (!action) return;

  const userId = user || req?.user?.id || 'system';
  const userRole = role || req?.user?.role || 'system';
  const ipAddress = req?.ip || '127.0.0.1';

  try {
    await prisma.auditLog.create({
      data: {
        user: String(userId),
        role: String(userRole),
        action,
        details: String(details || action),
        ipAddress
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Activity log failed:', action, error.message);
    }
  }
};
