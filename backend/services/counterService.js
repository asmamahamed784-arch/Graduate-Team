import prisma from '../config/prisma.js';
import { getAssignedCenterId, getRecordId, isStaffCenterRole, normalizeRole } from '../utils/rbac.js';

export class CounterService {
  static async listCounters(user) {
    const role = normalizeRole(user.role);
    const query = isStaffCenterRole(role) ? { center: getAssignedCenterId(user) } : {};
    const counters = await prisma.counter.findMany({ where: query });
    const centerIds = [...new Set(counters.map((counter) => counter.center).filter(Boolean))];
    const centers = centerIds.length
      ? await prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, district: true } })
      : [];
    const centersById = new Map(centers.map((center) => [center.id, center]));
    const data = counters.map((counter) => ({
      ...counter,
      number: counter.prefix || `Counter ${counter.lastNumber || 0}`,
      center: centersById.get(counter.center) || counter.center
    }));
    return data;
  }

  static async createCounter(data, user, ipAddress) {
    const { number, centerId, prefix } = data;

    const counter = await prisma.counter.create({
      data: {
        center: centerId,
        lastNumber: Number(number || 0),
        prefix: prefix || 'NQS'
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Create Counter',
        details: `Created counter ${number} associated with center ID ${centerId}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return counter;
  }

  static async updateCounter(id, data, user, ipAddress) {
    const counter = await prisma.counter.findUnique({
      where: { id }
    });

    if (!counter) {
      throw new Error('Counter not found');
    }

    if (isStaffCenterRole(user.role) && getRecordId(counter.center)?.toString() !== getAssignedCenterId(user)) {
      throw new Error('Operators can only update counters for their assigned center.');
    }

    const updated = await prisma.counter.update({
      where: { id },
      data: {
        center: isStaffCenterRole(user.role) ? counter.center : (data.centerId || data.center || counter.center),
        lastNumber: Number(data.number ?? data.lastNumber ?? counter.lastNumber),
        prefix: data.prefix || counter.prefix
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Update Counter',
        details: `Updated counter ${counter.prefix} properties`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return updated;
  }

  static async deleteCounter(id, user, ipAddress) {
    const counter = await prisma.counter.findUnique({
      where: { id }
    });
    if (!counter) {
      throw new Error('Counter not found');
    }

    await prisma.counter.delete({
      where: { id }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Delete Counter',
        details: `Deleted counter ${counter.prefix}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });
  }
}
