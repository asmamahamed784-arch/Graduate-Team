import prisma from '../config/prisma.js';
import { canAccessTicket } from '../utils/rbac.js';

// @desc    Get UI activity logs
// @route   GET /api/activities
// @access  Private/Admin
export const listActivityLogs = async (req, res) => {
  try {
    const list = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    const userIds = [...new Set(list.map((item) => item.user).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const data = list.map((item) => ({ ...item, user: usersById.get(item.user) || item.user }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify QR scan and register logs
// @route   POST /api/queue/scan
// @access  Private/Operator or Admin
export const verifyQRScan = async (req, res) => {
  try {
    const { ticketRef } = req.body;

    const ticket = await prisma.ticket.findFirst({ where: { ref: ticketRef } });
    if (ticket && !canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to verify tickets for this center.' });
    }
    const [service, center] = ticket
      ? await Promise.all([
          prisma.service.findUnique({ where: { id: ticket.service } }),
          prisma.center.findUnique({ where: { id: ticket.center } })
        ])
      : [null, null];

    let status = 'Invalid';
    if (ticket) {
      if (ticket.status === 'Cancelled') {
        status = 'Expired';
      } else {
        status = 'Valid';
      }
    }

    const scan = await prisma.qRScan.create({
      data: {
        ticketRef,
        scannedBy: req.user.id,
        status,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    if (status === 'Valid') {
      return res.json({
        success: true,
        message: 'Ticket checked.',
        data: {
          scanId: scan.id,
          ticketRef: ticket.ref,
          service: service?.name || 'National ID Registration',
          center: center?.name || 'Banaadir National ID Center',
          status: ticket.status
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Ticket check returned status: ${status}`,
        data: { scanId: scan.id, status }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
