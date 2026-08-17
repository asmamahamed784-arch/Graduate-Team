import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

export const MANAGED_ROLES = ['admin', 'super_admin', 'user_manager'];
export const ROLE_LABELS = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  user_manager: 'User Manager'
};

const normalizeSomaliPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

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

const isValidUsername = (value = '') => /^[A-Za-z0-9._-]+$/.test(String(value || ''));

const normalizeManagedRole = (role = '') => {
  const cleanRole = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return MANAGED_ROLES.includes(cleanRole) ? cleanRole : 'admin';
};

const generateSecurePassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '@#$%!';
  const all = `${upper}${lower}${numbers}${symbols}`;
  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    numbers[crypto.randomInt(numbers.length)],
    symbols[crypto.randomInt(symbols.length)]
  ];
  while (required.length < 12) {
    required.push(all[crypto.randomInt(all.length)]);
  }
  return required.sort(() => crypto.randomInt(3) - 1).join('');
};

const userSelect = {
  id: true,
  name: true,
  firstName: true,
  middleName: true,
  lastName: true,
  username: true,
  email: true,
  phone: true,
  nationalId: true,
  nationalIdStatus: true,
  cardSerialNumber: true,
  cardStatus: true,
  dateOfBirth: true,
  address: true,
  role: true,
  status: true,
  center: true,
  district: true,
  maritalStatus: true,
  createdAt: true,
  updatedAt: true,
  lastActiveAt: true,
  citizenProfile: true
};

const mergeCitizenProfile = (user) => {
  const citizen = user.citizenProfile || {};
  return {
    ...user,
    name: citizen.fullName || user.name,
    firstName: citizen.firstName ?? user.firstName,
    middleName: citizen.middleName ?? user.middleName,
    lastName: citizen.lastName ?? user.lastName,
    email: citizen.email ?? user.email,
    phone: citizen.phone || user.phone,
    nationalId: citizen.nationalId || user.nationalId,
    nationalIdStatus: citizen.nationalIdStatus || user.nationalIdStatus,
    cardSerialNumber: citizen.cardSerialNumber || user.cardSerialNumber,
    cardStatus: citizen.cardStatus || user.cardStatus,
    dateOfBirth: citizen.dateOfBirth || user.dateOfBirth,
    address: citizen.address || user.address,
    district: citizen.district || user.district,
    maritalStatus: citizen.maritalStatus || user.maritalStatus,
    citizenProfile: citizen.id ? { ...citizen, _id: citizen.id } : null
  };
};

const hydrateCenters = async (users = []) => {
  const centerIds = [...new Set(users.map((user) => user.center).filter(Boolean))];
  const centers = centerIds.length
    ? await prisma.center.findMany({
        where: { id: { in: centerIds } },
        select: { id: true, name: true, district: true, city: true, phone: true }
      })
    : [];
  const byId = new Map(centers.map((center) => [center.id, { ...center, _id: center.id }]));
  return users.map((user) => {
    const mergedUser = mergeCitizenProfile(user);
    return ({
      ...mergedUser,
      _id: user.id,
      center: user.center ? byId.get(user.center) || user.center : null
    });
  });
};

export class UserService {
  static async listUsers(query) {
    const { search = '', status = '', center = '', district = '', role = '' } = query;
    const requestedRole = String(role || '').trim().toLowerCase();
    let where = {};

    if (requestedRole === 'system' || requestedRole === 'admins') {
      where = { role: { in: MANAGED_ROLES } };
    } else if (MANAGED_ROLES.includes(requestedRole)) {
      where = { role: requestedRole };
    } else {
      where = { role: { in: ['citizen', 'user'] } };
    }

    if (status) where.status = status;
    if (center) where.center = center;
    if (district) where.district = { contains: String(district).trim(), mode: 'insensitive' };
    if (search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { nationalId: { contains: term, mode: 'insensitive' } },
        { cardSerialNumber: { contains: term, mode: 'insensitive' } }
      ];
    }

    const users = await hydrateCenters(await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    }));
    return users;
  }

  static async createAdminUser(data, auditUser, ipAddress) {
    const { name, username, phone, role, password, temporaryPassword: requestedTemporaryPassword } = data;
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPhone = phone ? normalizeSomaliPhone(phone) : null;
    const cleanRole = normalizeManagedRole(role);
    const manualPassword = String(password || requestedTemporaryPassword || '').trim();

    if (!cleanName || !cleanUsername || !cleanPhone) {
      throw new Error('Name, username, and phone are required.');
    }
    if (!isValidUsername(cleanUsername)) {
      throw new Error('Username may contain letters, numbers, dots, underscores, and hyphens.');
    }
    if (manualPassword && manualPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const temporaryPassword = manualPassword || generateSecurePassword();

    try {
      if (await phoneAlreadyExists(cleanPhone)) {
        throw new Error('This phone number is already in use.');
      }

      const admin = await prisma.user.create({
        data: {
          name: cleanName,
          username: cleanUsername,
          phone: cleanPhone,
          password: await bcrypt.hash(temporaryPassword, 10),
          role: cleanRole,
          status: 'active',
          mustChangePassword: false,
          accountProfile: {
            create: {
              name: cleanName,
              phone: cleanPhone,
              status: 'active',
              operatorType: cleanRole,
              mustChangePassword: false
            }
          }
        },
        select: userSelect
      });

      await prisma.auditLog.create({
        data: {
          user: auditUser.id,
          role: auditUser.role,
          action: 'Create System User',
          details: `Created ${ROLE_LABELS[cleanRole]} username ${cleanUsername}`,
          ipAddress: ipAddress || '127.0.0.1'
        }
      });

      return { admin, temporaryPassword };
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

  static async getUserDetails(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect
    });
    if (!user || !['citizen', 'user', ...MANAGED_ROLES].includes(user.role)) {
      throw new Error('User not found.');
    }

    const [hydratedUser] = await hydrateCenters([user]);
    const bookingHistory = ['citizen', 'user'].includes(user.role)
      ? await prisma.ticket.findMany({
          where: { citizen: user.id },
          orderBy: { createdAt: 'desc' }
        })
      : [];

    return { user: hydratedUser, bookingHistory };
  }

  static async updateUserStatus(id, status, auditUser, ipAddress) {
    const allowedStatuses = ['active', 'inactive', 'locked', 'suspended'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid user status.');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !['citizen', 'user', ...MANAGED_ROLES].includes(user.role)) {
      throw new Error('User not found.');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status },
      select: userSelect
    });

    await prisma.auditLog.create({
      data: {
        user: auditUser.id,
        role: auditUser.role,
        action: 'Update User Status',
        details: `Updated user ${user.username} status to ${status}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    const [hydrated] = await hydrateCenters([updated]);
    return hydrated;
  }

  static async deleteAdminUser(id, auditUser, ipAddress) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !MANAGED_ROLES.includes(user.role)) {
      throw new Error('Managed account not found.');
    }

    if (user.id === auditUser.id) {
      throw new Error('You cannot delete the admin account you are currently using.');
    }

    const adminCount = await prisma.user.count({ where: { role: { in: ['admin', 'super_admin'] } } });
    if (['admin', 'super_admin'].includes(user.role) && adminCount <= 1) {
      throw new Error('At least one admin account must remain.');
    }

    await prisma.$transaction(async (tx) => {
      const { deleteUserCascade } = await import('../utils/cascadeDelete.js');
      await deleteUserCascade(user.id, tx);
      await tx.auditLog.create({
        data: {
          user: auditUser.id,
          role: auditUser.role,
          action: 'Delete Admin User',
          details: `Deleted admin username ${user.username}`,
          ipAddress: ipAddress || '127.0.0.1'
        }
      });
    });
  }

  static async resetUserPassword(id, temporaryPassword, auditUser, ipAddress) {
    if (!temporaryPassword || temporaryPassword.length < 6) {
      throw new Error('Temporary password must be at least 6 characters.');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !['citizen', 'user'].includes(user.role)) {
      throw new Error('User not found.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: false
      }
    });

    await prisma.auditLog.create({
      data: {
        user: auditUser.id,
        role: auditUser.role,
        action: 'Reset User Password',
        details: `Reset password for user ${user.username}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });
  }
}
