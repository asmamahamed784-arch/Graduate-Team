import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

const MANAGED_ROLES = ['admin', 'super_admin', 'user_manager'];
const ROLE_LABELS = {
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

export const listUsers = async (req, res) => {
  try {
    const { search = '', status = '', center = '', district = '', role = '' } = req.query;
    const requestedRole = String(role || '').trim().toLowerCase();
    let where;

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

    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { name, username, phone, role, password, temporaryPassword: requestedTemporaryPassword } = req.body;
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPhone = phone ? normalizeSomaliPhone(phone) : null;
    const cleanRole = normalizeManagedRole(role);
    const manualPassword = String(password || requestedTemporaryPassword || '').trim();

    if (!cleanName || !cleanUsername || !cleanPhone) {
      return res.status(400).json({ success: false, message: 'Name, username, and phone are required.' });
    }
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Username may contain letters, numbers, dots, underscores, and hyphens.' });
    }

    if (manualPassword && manualPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const temporaryPassword = manualPassword || generateSecurePassword();

    const usernameExists = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (usernameExists) {
      return res.status(400).json({ success: false, message: 'This username is already in use.' });
    }
    if (await phoneAlreadyExists(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
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
        user: req.user.id,
        role: req.user.role,
        action: 'Create System User',
        details: `Created ${ROLE_LABELS[cleanRole]} username ${cleanUsername}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.status(201).json({
      success: true,
      data: { ...admin, _id: admin.id },
      temporaryPassword,
      message: 'Account created. Show this generated password once and store it securely.'
    });
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

export const getUserDetails = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect
    });
    if (!user || !['citizen', 'user', ...MANAGED_ROLES].includes(user.role)) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [hydratedUser] = await hydrateCenters([user]);
    const bookingHistory = ['citizen', 'user'].includes(user.role)
      ? await prisma.ticket.findMany({
          where: { citizen: user.id },
          orderBy: { createdAt: 'desc' }
        })
      : [];

    return res.json({
      success: true,
      data: {
        user: hydratedUser,
        bookingHistory: bookingHistory.map((ticket) => ({ ...ticket, _id: ticket.id }))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['active', 'inactive', 'locked', 'suspended'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid user status.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || !['citizen', 'user', ...MANAGED_ROLES].includes(user.role)) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status },
      select: userSelect
    });

    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Update User Status',
        details: `Updated user ${user.username} status to ${status}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    const [hydrated] = await hydrateCenters([updated]);
    return res.json({ success: true, data: hydrated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || !MANAGED_ROLES.includes(user.role)) {
      return res.status(404).json({ success: false, message: 'Managed account not found.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete the admin account you are currently using.' });
    }

    const adminCount = await prisma.user.count({ where: { role: { in: ['admin', 'super_admin'] } } });
    if (['admin', 'super_admin'].includes(user.role) && adminCount <= 1) {
      return res.status(400).json({ success: false, message: 'At least one admin account must remain.' });
    }

    await prisma.$transaction([
      prisma.activeSession.deleteMany({ where: { user: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
      prisma.auditLog.create({
        data: {
          user: req.user.id,
          role: req.user.role,
          action: 'Delete Admin User',
          details: `Deleted admin username ${user.username}`,
          ipAddress: req.ip || '127.0.0.1'
        }
      })
    ]);

    return res.json({ success: true, message: 'Managed account deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Temporary password must be at least 6 characters.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || !['citizen', 'user'].includes(user.role)) {
      return res.status(404).json({ success: false, message: 'User not found.' });
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
        user: req.user.id,
        role: req.user.role,
        action: 'Reset User Password',
        details: `Reset password for user ${user.username}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
