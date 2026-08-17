import prisma from '../config/prisma.js';
import { canAccessTicket } from '../utils/rbac.js';

export class ActivityService {
  /**
   * Get UI activity logs along with user information
   */
  static async listActivityLogs() {
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

    return data;
  }

  /**
   * Verify QR scan and register logs
   */
  static async verifyQRScan({ ticketRef, user, ipAddress }) {
    const ticket = await prisma.ticket.findFirst({ where: { ref: ticketRef } });
    if (ticket && !canAccessTicket(user, ticket)) {
      const error = new Error('You are not authorized to verify tickets for this center.');
      error.statusCode = 403;
      throw error;
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
        scannedBy: user?.id,
        status,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    if (status === 'Valid') {
      return {
        success: true,
        message: 'Ticket checked.',
        data: {
          scanId: scan.id,
          ticketRef: ticket.ref,
          service: service?.name || 'National ID Registration',
          center: center?.name || 'Banaadir National ID Center',
          status: ticket.status
        }
      };
    } else {
      return {
        success: false,
        statusCode: 400,
        message: `Ticket check returned status: ${status}`,
        data: { scanId: scan.id, status }
      };
    }
  }
}
