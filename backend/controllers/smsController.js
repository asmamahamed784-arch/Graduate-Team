import prisma from '../config/prisma.js';

export const listSmsLogs = async (req, res) => {
  try {
    const { search = '', status = '' } = req.query;
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

    return res.json({ success: true, count: logs.length, data: logs.map((log) => ({ ...log, _id: log.id })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendFailedSms = async (req, res) => {
  try {
    const log = await prisma.sMSLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      return res.status(404).json({ success: false, message: 'SMS log not found.' });
    }
    if (String(log.status || '').toLowerCase() !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only failed SMS logs can be resent.' });
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
        user: req.user.id,
        role: req.user.role,
        action: 'Resend SMS',
        details: `Retried failed SMS to ${log.recipient}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, data: { ...resent, _id: resent.id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
