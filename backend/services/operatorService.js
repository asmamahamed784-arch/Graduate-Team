import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { getAssignedCenterId, isAdminRole, normalizeAccountStatus, normalizeRole } from '../utils/rbac.js';
import { getCenterDistrict } from '../utils/nqsScope.js';
import { logActivity } from '../utils/activityLogger.js';

const serializeOperator = (operator) => ({
  id: operator.id,
  _id: operator.id,
  name: operator.name,
  username: operator.username,
  email: operator.email,
  phone: operator.phone,
  role: normalizeRole(operator.role),
  operatorType: operator.operatorType || normalizeRole(operator.role),
  status: operator.status,
  assignedDistrict: operator.assignedDistrict || getCenterDistrict(operator.center),
  center: operator.center,
  mustChangePassword: operator.mustChangePassword,
  createdAt: operator.createdAt,
  updatedAt: operator.updatedAt,
  lastActiveAt: operator.lastActiveAt
});

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  role: true,
  operatorType: true,
  status: true,
  assignedDistrict: true,
  mustChangePassword: false,
  createdAt: true,
  updatedAt: true,
  center: true,
  lastActiveAt: true
};

const hydrateOperatorCenters = async (operators = []) => {
  const centerIds = [...new Set(operators.map((operator) => operator.center).filter(Boolean))];
  const centers = centerIds.length
    ? await prisma.center.findMany({
        where: { id: { in: centerIds } },
        select: { id: true, name: true, address: true, city: true, district: true, phone: true }
      })
    : [];
  const centerById = new Map(centers.map((center) => [center.id, { ...center, _id: center.id }]));

  return operators.map((operator) => ({
    ...operator,
    center: operator.center ? centerById.get(operator.center) || operator.center : null
  }));
};

const normalizeOperatorType = (operatorType) => (
  ['center_manager', 'super_operator'].includes(String(operatorType || '').toLowerCase())
    ? 'center_manager'
    : 'operator'
);

const normalizeSomaliPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

const isValidSomaliPhone = (value = '') => /^\+25261\d{7}$/.test(normalizeSomaliPhone(value));
const isValidUsername = (value = '') => /^[A-Za-z0-9._-]+$/.test(String(value || ''));

const phoneKey = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('252')) return digits;
  if (digits.startsWith('0')) return `252${digits.slice(1)}`;
  if (digits.startsWith('61')) return `252${digits}`;
  return digits;
};

const phoneAlreadyExists = async (phone, excludeId = '') => {
  const target = phoneKey(phone);
  if (!target) return false;
  const users = await prisma.user.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    select: {
      phone: true,
      citizenProfile: { select: { phone: true } },
      accountProfile: { select: { phone: true } }
    }
  });
  return users.some((user) => (
    [user.phone, user.citizenProfile?.phone, user.accountProfile?.phone]
      .some((value) => phoneKey(value) === target)
  ));
};

const hashPassword = (password) => bcrypt.hash(password, 10);

const sameCenter = (left, right) => Boolean(left && right && left.toString() === right.toString());

const notifyAdmins = async ({ title, desc, relatedEntity = null, notificationType = '', io = null }) => {
  const admins = await prisma.user.findMany({ where: { role: { in: ['admin', 'super_admin'] } }, select: { id: true } });
  const notifications = await Promise.all(admins.map((admin) => prisma.notification.create({
    data: {
      user: admin.id,
      title,
      desc,
      category: 'Operator Approval',
      notificationType,
      relatedEntity,
      relatedEntityType: 'User'
    }
  })));
  if (io) {
    notifications.forEach((notification) => {
      io.emit(`notification-${notification.user}`, notification);
    });
  }
};

export class OperatorService {
  static async listOperators(user) {
    const query = { role: { in: ['operator', 'super_operator', 'center_manager'] } };
    const requesterRole = normalizeRole(user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);

    if (isCenterManager) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!assignedCenterId) {
        throw new Error('Your account is not assigned to a center.');
      }
      query.center = assignedCenterId;
    }

    const operators = await prisma.user.findMany({
      where: query,
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    });
    const hydratedOperators = await hydrateOperatorCenters(operators);

    return {
      count: hydratedOperators.length,
      data: hydratedOperators.map(serializeOperator)
    };
  }

  static async getOperatorCenterStats() {
    const centers = await prisma.center.findMany({
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, district: true, address: true, phone: true, status: true, isActive: true }
    });

    const data = await Promise.all(centers.map(async (center) => {
      const [
        staffCount,
        allAppointments,
        waiting,
        completed,
        cancelled,
        newRegistration,
        updateInformation,
        replaceLostId
      ] = await Promise.all([
        prisma.user.count({
          where: {
            center: center.id,
            role: { in: ['operator', 'super_operator', 'center_manager'] }
          }
        }),
        prisma.ticket.count({ where: { center: center.id } }),
        prisma.ticket.count({
          where: {
            center: center.id,
            OR: [
              { status: { in: ['Waiting', 'Pending', 'In Progress', 'Being Served', 'On Hold'] } },
              { requestStatus: { in: ['Pending', 'Approved', 'Resubmission Required'] } }
            ]
          }
        }),
        prisma.ticket.count({ where: { center: center.id, status: 'Completed' } }),
        prisma.ticket.count({ where: { center: center.id, status: 'Cancelled' } }),
        prisma.ticket.count({ where: { center: center.id, requestType: 'new_national_id' } }),
        prisma.ticket.count({ where: { center: center.id, requestType: 'update_information' } }),
        prisma.ticket.count({ where: { center: center.id, requestType: 'lost_replacement' } })
      ]);

      return {
        centerId: center.id,
        centerIds: [center.id],
        centerKey: center.id,
        centerName: center.name,
        district: center.district,
        address: center.address,
        phone: center.phone,
        status: center.status,
        isActive: center.isActive,
        staffCount,
        stats: {
          allAppointments,
          waiting,
          completed,
          cancelled,
          newRegistration,
          updateInformation,
          replaceLostId
        }
      };
    }));

    return {
      count: data.length,
      data
    };
  }

  static async createOperator(data, user, ip, io) {
    const { name, username, email, phone, center, operatorType = 'operator', temporaryPassword } = data;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPhone = normalizeSomaliPhone(phone);
    const requesterRole = normalizeRole(user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);
    const assignedCenterId = getAssignedCenterId(user);
    const cleanOperatorType = isAdminRole(requesterRole)
      ? normalizeOperatorType(operatorType)
      : 'operator';
    const requestedCenter = isCenterManager ? assignedCenterId : center;

    if (isCenterManager && !assignedCenterId) {
      throw new Error('Center managers can only manage their assigned center.');
    }

    if (!name || !cleanUsername || !cleanPhone || !requestedCenter || !temporaryPassword) {
      throw new Error('Name, username, phone, center, and temporary password are required.');
    }
    if (!isValidUsername(cleanUsername)) {
      throw new Error('Username may contain letters, numbers, dots, underscores, and hyphens.');
    }

    if (!isValidSomaliPhone(cleanPhone)) {
      throw new Error('Phone number must be a valid Somali number.');
    }

    const centerExists = await prisma.center.findUnique({ where: { id: requestedCenter } });
    if (!centerExists) {
      throw new Error('Assigned center not found.');
    }

    if (isCenterManager && !sameCenter(assignedCenterId, requestedCenter)) {
      throw new Error('Center managers can only manage their assigned center.');
    }

    const usernameExists = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (usernameExists) {
      throw new Error('This username is already in use.');
    }

    if (await phoneAlreadyExists(cleanPhone)) {
      throw new Error('This phone number is already in use.');
    }

    const initialStatus = isCenterManager ? 'pending_approval' : 'active';

    try {
      const operator = await prisma.user.create({
        data: {
          name,
          username: cleanUsername,
          email: email ? String(email).trim().toLowerCase() : undefined,
          phone: cleanPhone,
          password: await hashPassword(temporaryPassword),
          role: cleanOperatorType,
          operatorType: cleanOperatorType,
          status: initialStatus,
          center: requestedCenter,
          assignedDistrict: getCenterDistrict(centerExists),
          mustChangePassword: false,
          accountProfile: {
            create: {
              name,
              email: email ? String(email).trim().toLowerCase() : null,
              phone: cleanPhone,
              status: initialStatus,
              operatorType: cleanOperatorType,
              center: requestedCenter,
              assignedDistrict: getCenterDistrict(centerExists),
              district: getCenterDistrict(centerExists),
              mustChangePassword: false
            }
          }
        }
      });

      if (isCenterManager) {
        await notifyAdmins({
          title: 'Operator Approval Required',
          desc: `${user.name || user.username} created operator ${cleanUsername} for ${centerExists.name}.`,
          relatedEntity: operator.id,
          notificationType: 'OPERATOR_APPROVAL_REQUIRED',
          io
        });
      }

      await prisma.auditLog.create({
        data: {
          user: user.id,
          role: user.role,
          action: 'Create Operator',
          details: `Created ${cleanOperatorType} username ${cleanUsername} for ${centerExists.name} with status ${initialStatus}`,
          ipAddress: ip || '127.0.0.1'
        }
      });

      const populated = await prisma.user.findUnique({
        where: { id: operator.id },
        select: userSelect
      });
      const [hydrated] = await hydrateOperatorCenters([populated]);
      return serializeOperator(hydrated);
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        throw new Error('This username is already in use.');
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
        throw new Error('This phone number is already in use.');
      }
      throw error;
    }
  }

  static async updateOperator(id, data, user, ip) {
    const { name, email, phone, center, operatorType, status } = data;
    const operator = await prisma.user.findUnique({ where: { id } });

    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      throw new Error('Operator not found.');
    }

    const requesterRole = normalizeRole(user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);
    const assignedCenterId = getAssignedCenterId(user);
    if (isCenterManager && !sameCenter(operator.center, assignedCenterId)) {
      throw new Error('Center managers can only manage their assigned center.');
    }

    const nextCenter = center || operator.center;
    const nextCenterDoc = nextCenter
      ? await prisma.center.findUnique({ where: { id: nextCenter } })
      : null;
    if (!nextCenterDoc) {
      throw new Error('Assigned center not found.');
    }

    if (isCenterManager && !sameCenter(nextCenter, assignedCenterId)) {
      throw new Error('Center managers cannot move staff to another center.');
    }

    if (email && email !== operator.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: String(email).trim().toLowerCase(), id: { not: operator.id } }
      });
      if (emailTaken) {
        throw new Error('Email is already in use.');
      }
    }

    const cleanOperatorType = isAdminRole(requesterRole)
      ? (operatorType ? normalizeOperatorType(operatorType) : operator.operatorType)
      : 'operator';
    const nextStatus = status ? normalizeAccountStatus(status) : operator.status;
    const cleanPhone = phone ? normalizeSomaliPhone(phone) : operator.phone;
    if (phone && !isValidSomaliPhone(cleanPhone)) {
      throw new Error('Phone number must be a valid Somali number.');
    }
    if (phone && await phoneAlreadyExists(cleanPhone, operator.id)) {
      throw new Error('This phone number is already in use.');
    }
    
    try {
      const updatedOperator = await prisma.user.update({
        where: { id: operator.id },
        data: {
          name: name || operator.name,
          email: email === '' ? null : (email || operator.email),
          phone: cleanPhone,
          center: nextCenter,
          operatorType: cleanOperatorType,
          role: cleanOperatorType,
          status: isCenterManager ? operator.status : nextStatus,
          assignedDistrict: getCenterDistrict(nextCenterDoc)
        }
      });
      await prisma.accountProfile.updateMany({
        where: { userId: operator.id },
        data: {
          name: name || operator.name,
          email: email === '' ? null : (email || operator.email),
          phone: cleanPhone,
          center: nextCenter,
          operatorType: cleanOperatorType,
          status: isCenterManager ? operator.status : nextStatus,
          assignedDistrict: getCenterDistrict(nextCenterDoc),
          district: getCenterDistrict(nextCenterDoc)
        }
      });

      await prisma.auditLog.create({
        data: {
          user: user.id,
          role: user.role,
          action: 'Update Operator',
          details: `Updated operator username ${updatedOperator.username}`,
          ipAddress: ip || '127.0.0.1'
        }
      });

      const populated = await prisma.user.findUnique({
        where: { id: updatedOperator.id },
        select: userSelect
      });
      const [hydrated] = await hydrateOperatorCenters([populated]);
      return serializeOperator(hydrated);
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        throw new Error('This username is already in use.');
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
        throw new Error('This phone number is already in use.');
      }
      throw error;
    }
  }

  static async setOperatorApprovalStatus(id, status, action, user, ip, req) {
    const operator = await prisma.user.findUnique({ where: { id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      throw new Error('Operator not found.');
    }

    const updatedOperator = await prisma.user.update({
      where: { id: operator.id },
      data: { status }
    });
    await prisma.accountProfile.updateMany({
      where: { userId: operator.id },
      data: { status }
    });
    await prisma.notification.deleteMany({
      where: {
        relatedEntity: operator.id,
        relatedEntityType: 'User',
        notificationType: 'OPERATOR_APPROVAL_REQUIRED'
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action,
        details: `${action} for operator username ${operator.username}`,
        ipAddress: ip || '127.0.0.1'
      }
    });
    await logActivity({
      req,
      action: action === 'Approve Operator' ? 'Operator Approval' : action,
      details: `${action} for operator username ${operator.username}`
    });

    const notificationCopy = {
      active: {
        title: 'Operator Account Approved',
        desc: 'Your operator account has been approved. You can now log in.',
        type: 'OPERATOR_APPROVED'
      },
      inactive: {
        title: 'Operator Account Deactivated',
        desc: 'Your operator account has been deactivated by the Super Admin.',
        type: 'OPERATOR_DEACTIVATED'
      },
      rejected: {
        title: 'Operator Account Rejected',
        desc: 'Your operator account request was rejected by the Super Admin.',
        type: 'OPERATOR_REJECTED'
      }
    }[status] || {
      title: 'Operator Account Updated',
      desc: 'Your operator account status was updated by the Super Admin.',
      type: 'OPERATOR_STATUS_UPDATED'
    };

    await prisma.notification.create({
      data: {
        user: operator.id,
        title: notificationCopy.title,
        desc: notificationCopy.desc,
        category: 'Operator Approval',
        notificationType: notificationCopy.type,
        relatedEntity: operator.id,
        relatedEntityType: 'User'
      }
    });

    const [hydrated] = await hydrateOperatorCenters([updatedOperator]);
    return serializeOperator(hydrated);
  }

  static async getOperatorDetails(id, user) {
    const operator = await prisma.user.findUnique({
      where: { id },
      select: userSelect
    });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      throw new Error('Operator not found.');
    }

    const requesterRole = normalizeRole(user.role);
    if (['super_operator', 'center_manager'].includes(requesterRole)) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!sameCenter(operator.center, assignedCenterId)) {
        throw new Error('Center managers can only view staff from their assigned center.');
      }
    }

    const [hydratedOperator] = await hydrateOperatorCenters([operator]);
    const [activity, loginHistory] = await Promise.all([
      prisma.auditLog.findMany({
        where: { user: operator.id },
        orderBy: { timestamp: 'desc' },
        take: 50
      }),
      prisma.activeSession.findMany({
        where: { user: operator.id },
        orderBy: { loginTime: 'desc' },
        take: 50
      })
    ]);

    return {
      operator: serializeOperator(hydratedOperator),
      activity,
      loginHistory
    };
  }

  static async deleteOperator(id, user, ip) {
    const operator = await prisma.user.findUnique({ where: { id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      throw new Error('Operator not found.');
    }

    await prisma.$transaction(async (tx) => {
      const { deleteUserCascade } = await import('../utils/cascadeDelete.js');
      await deleteUserCascade(operator.id, tx);
      await tx.auditLog.create({
        data: {
          user: user.id,
          role: user.role,
          action: 'Delete Operator',
          details: `Deleted operator username ${operator.username}`,
          ipAddress: ip || '127.0.0.1'
        }
      });
    });

    return { message: 'Operator deleted.' };
  }

  static async resetOperatorPassword(id, data, user, ip) {
    const { temporaryPassword } = data;
    if (!temporaryPassword || temporaryPassword.length < 6) {
      throw new Error('Temporary password must be at least 6 characters.');
    }

    const operator = await prisma.user.findUnique({ where: { id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      throw new Error('Operator not found.');
    }

    const requesterRole = normalizeRole(user.role);
    if (['super_operator', 'center_manager'].includes(requesterRole)) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!sameCenter(operator.center, assignedCenterId)) {
        throw new Error('Center managers can only manage their assigned center.');
      }
    }

    await prisma.user.update({
      where: { id: operator.id },
      data: {
        password: await hashPassword(temporaryPassword),
        mustChangePassword: false
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Reset Operator Password',
        details: `Reset password for operator username ${operator.username}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    return { message: 'Password updated successfully.' };
  }
}
