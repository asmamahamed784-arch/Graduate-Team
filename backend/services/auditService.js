import prisma from '../config/prisma.js';

export class AuditService {
  static async getAuditLogs(queryParams = {}) {
    const { action, role, search, dateFrom, dateTo, page = 1, limit = 10 } = queryParams;

    const query = {};

    if (action && action !== 'All') {
      query.action = action;
    }
    if (role && role !== 'All') {
      query.role = role;
    }
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) query.timestamp.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
    if (search) {
      query.OR = [
        { action: { contains: String(search), mode: 'insensitive' } },
        { details: { contains: String(search), mode: 'insensitive' } },
        { role: { contains: String(search), mode: 'insensitive' } },
        { ipAddress: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const logs = await prisma.auditLog.findMany({
      where: query,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limitNum
    });
    const userIds = [...new Set(logs.map((log) => log.user).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true, email: true, role: true }
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const data = logs.map((log) => ({ ...log, user: usersById.get(log.user) || log.user }));

    const total = await prisma.auditLog.count({
      where: query
    });

    const [adminAccounts, operatorAccounts, citizenAccounts] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['admin', 'super_admin', 'user_manager'] } } }),
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] } } }),
      prisma.user.count({ where: { role: { in: ['citizen', 'user'] } } })
    ]);
    const accountStats = {
      all: adminAccounts + operatorAccounts + citizenAccounts,
      admin: adminAccounts,
      operator: operatorAccounts,
      citizen: citizenAccounts
    };

    return {
      count: data.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      },
      accountStats,
      data
    };
  }
}
