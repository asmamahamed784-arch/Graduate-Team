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
  updatedAt: operator.updatedAt
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
  center: true
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

export const listOperators = async (req, res) => {
  try {
    const query = { role: { in: ['operator', 'super_operator', 'center_manager'] } };
    const requesterRole = normalizeRole(req.user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);

    if (isCenterManager) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!assignedCenterId) {
        return res.status(403).json({ success: false, message: 'Your account is not assigned to a center.' });
      }
      query.center = assignedCenterId;
    }

    const operators = await prisma.user.findMany({
      where: query,
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    });
    const hydratedOperators = await hydrateOperatorCenters(operators);

    return res.json({ success: true, count: hydratedOperators.length, data: hydratedOperators.map(serializeOperator) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOperatorCenterStats = async (req, res) => {
  try {
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

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOperator = async (req, res) => {
  try {
    const { name, username, email, phone, center, operatorType = 'operator', temporaryPassword } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPhone = normalizeSomaliPhone(phone);
    const requesterRole = normalizeRole(req.user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);
    const assignedCenterId = getAssignedCenterId(req.user);
    const cleanOperatorType = isAdminRole(requesterRole)
      ? normalizeOperatorType(operatorType)
      : 'operator';
    const requestedCenter = isCenterManager ? assignedCenterId : center;

    if (isCenterManager && !assignedCenterId) {
      return res.status(403).json({ success: false, message: 'Center managers can only manage their assigned center.' });
    }

    if (!name || !cleanUsername || !cleanPhone || !requestedCenter || !temporaryPassword) {
      return res.status(400).json({ success: false, message: 'Name, username, phone, center, and temporary password are required.' });
    }
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Username may contain letters, numbers, dots, underscores, and hyphens.' });
    }

    if (!isValidSomaliPhone(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be a valid Somali number.' });
    }

    const centerExists = await prisma.center.findUnique({ where: { id: requestedCenter } });
    if (!centerExists) {
      return res.status(404).json({ success: false, message: 'Assigned center not found.' });
    }

    if (isCenterManager && !sameCenter(assignedCenterId, requestedCenter)) {
      return res.status(403).json({ success: false, message: 'Center managers can only manage their assigned center.' });
    }

    const usernameExists = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (usernameExists) {
      return res.status(400).json({ success: false, message: 'This username is already in use.' });
    }

    if (await phoneAlreadyExists(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
    }

    const initialStatus = 'pending_approval';

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
        desc: `${req.user.name || req.user.username} created operator ${cleanUsername} for ${centerExists.name}.`,
        relatedEntity: operator.id,
        notificationType: 'OPERATOR_APPROVAL_REQUIRED',
        io: req.app.get('io')
      });
    } else {
      await notifyAdmins({
        title: 'Operator Approval Required',
        desc: `New ${cleanOperatorType === 'center_manager' ? 'center manager' : 'operator'} ${cleanUsername} was created for ${centerExists.name} and is waiting for approval.`,
        relatedEntity: operator.id,
        notificationType: 'OPERATOR_APPROVAL_REQUIRED',
        io: req.app.get('io')
      });
    }

    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Create Operator',
        details: `Created ${cleanOperatorType} username ${cleanUsername} for ${centerExists.name} with status ${initialStatus}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    const populated = await prisma.user.findUnique({
      where: { id: operator.id },
      select: userSelect
    });
    const [hydrated] = await hydrateOperatorCenters([populated]);
    return res.status(201).json({ success: true, data: serializeOperator(hydrated) });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return res.status(400).json({ success: false, message: 'This username is already in use.' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOperator = async (req, res) => {
  try {
    const { name, email, phone, center, operatorType, status } = req.body;
    const operator = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    const isCenterManager = ['super_operator', 'center_manager'].includes(requesterRole);
    const assignedCenterId = getAssignedCenterId(req.user);
    if (isCenterManager && !sameCenter(operator.center, assignedCenterId)) {
      return res.status(403).json({ success: false, message: 'Center managers can only manage their assigned center.' });
    }

    const nextCenter = center || operator.center;
    const nextCenterDoc = nextCenter
      ? await prisma.center.findUnique({ where: { id: nextCenter } })
      : null;
    if (!nextCenterDoc) {
      return res.status(404).json({ success: false, message: 'Assigned center not found.' });
    }

    if (isCenterManager && !sameCenter(nextCenter, assignedCenterId)) {
      return res.status(403).json({ success: false, message: 'Center managers cannot move staff to another center.' });
    }

    if (email && email !== operator.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: String(email).trim().toLowerCase(), id: { not: operator.id } }
      });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: 'Email is already in use.' });
      }
    }

    const cleanOperatorType = isAdminRole(requesterRole)
      ? (operatorType ? normalizeOperatorType(operatorType) : operator.operatorType)
      : 'operator';
    const nextStatus = status ? normalizeAccountStatus(status) : operator.status;
    const cleanPhone = phone ? normalizeSomaliPhone(phone) : operator.phone;
    if (phone && !isValidSomaliPhone(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be a valid Somali number.' });
    }
    if (phone && await phoneAlreadyExists(cleanPhone, operator.id)) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
    }
    
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
        user: req.user.id,
        role: req.user.role,
        action: 'Update Operator',
        details: `Updated operator username ${updatedOperator.username}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    const populated = await prisma.user.findUnique({
      where: { id: updatedOperator.id },
      select: userSelect
    });
    const [hydrated] = await hydrateOperatorCenters([populated]);
    return res.json({ success: true, data: serializeOperator(hydrated) });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return res.status(400).json({ success: false, message: 'This username is already in use.' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const setOperatorApprovalStatus = async (req, res, status, action) => {
  try {
    const operator = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const updatedOperator = await prisma.user.update({
      where: { id: operator.id },
      data: { status }
    });
    await prisma.accountProfile.updateMany({
      where: { userId: operator.id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action,
        details: `${action} for operator username ${operator.username}`,
        ipAddress: req.ip || '127.0.0.1'
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
    return res.json({ success: true, data: serializeOperator(hydrated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const approveOperator = (req, res) => setOperatorApprovalStatus(req, res, 'active', 'Approve Operator');

export const rejectOperator = (req, res) => setOperatorApprovalStatus(req, res, 'rejected', 'Reject Operator');

export const activateOperator = (req, res) => setOperatorApprovalStatus(req, res, 'active', 'Activate Operator');

export const deactivateOperator = (req, res) => setOperatorApprovalStatus(req, res, 'inactive', 'Deactivate Operator');

export const getOperatorDetails = async (req, res) => {
  try {
    const operator = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect
    });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    if (['super_operator', 'center_manager'].includes(requesterRole)) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!sameCenter(operator.center, assignedCenterId)) {
        return res.status(403).json({ success: false, message: 'Center managers can only view staff from their assigned center.' });
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

    return res.json({
      success: true,
      data: {
        operator: serializeOperator(hydratedOperator),
        activity,
        loginHistory
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOperator = async (req, res) => {
  try {
    const operator = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    await prisma.user.delete({ where: { id: operator.id } });
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Delete Operator',
        details: `Deleted operator username ${operator.username}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, message: 'Operator deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetOperatorPassword = async (req, res) => {
  try {
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Temporary password must be at least 6 characters.' });
    }

    const operator = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!operator || !['operator', 'super_operator', 'center_manager'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    if (['super_operator', 'center_manager'].includes(requesterRole)) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!sameCenter(operator.center, assignedCenterId)) {
        return res.status(403).json({ success: false, message: 'Center managers can only manage their assigned center.' });
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
        user: req.user.id,
        role: req.user.role,
        action: 'Reset Operator Password',
        details: `Reset password for operator username ${operator.username}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
