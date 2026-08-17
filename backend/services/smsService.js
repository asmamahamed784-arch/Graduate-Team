import prisma from '../config/prisma.js';

export class SmsService {
  static async listSmsLogs({ search = '', status = '' }) {
    const where = {};
    if (status) where.status = status;
    if (search.trim()) {
      const term = search.trim();
      where.OR = [
        { recipient: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } }
      ];
    }

    const logs = await prisma.sMSLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 500
    });

    return logs.map((log) => ({ ...log, _id: log.id }));
  }

  static async resendFailedSms({ id, user, ipAddress }) {
    const log = await prisma.sMSLog.findUnique({ where: { id } });
    if (!log) {
      throw { statusCode: 404, message: 'SMS log not found.' };
    }
    if (String(log.status || '').toLowerCase() !== 'failed') {
      throw { statusCode: 400, message: 'Only failed SMS logs can be resent.' };
    }

    const resent = await prisma.sMSLog.create({
      data: {
        recipient: log.recipient,
        message: log.message,
        status: 'Sent'
      }
    });
    
    await prisma.sMSLog.update({
      where: { id: log.id },
      data: { status: 'Retried' }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Resend SMS',
        details: `Retried failed SMS to ${log.recipient}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return { ...resent, _id: resent.id };
  }
}
