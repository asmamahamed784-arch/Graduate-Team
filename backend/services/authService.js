import prisma from '../config/prisma.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendRegistrationEmail } from '../services/emailService.js';
import { requestOtp, verifyOtp } from '../services/otpService.js';
import { isActiveAccountStatus, isStaffCenterRole, normalizeAccountStatus, normalizeRole, normalizeUserRole } from '../utils/rbac.js';
import { getCenterDistrict } from '../utils/nqsScope.js';
import { logActivity } from '../utils/activityLogger.js';
import { ERRORS } from '../utils/errorMessages.js';
import { generatePermanentNqsId } from '../utils/citizenIdentity.js';

const generateToken = (id, role) => {
  const tokenId = crypto.randomUUID();
  return {
    tokenId,
    token: jwt.sign({ id, role: normalizeRole(role), jti: tokenId }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    })
  };
};

const LOGIN_OTP_ROLES = new Set([]);

const getLoginOtpRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'super_operator' ? 'center_manager' : normalizedRole;
};

const normalizeLoginPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  let local = digits;
  if (local.startsWith('252')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local;
};

const isValidSomaliLoginPhone = (value = '') => /^61\d{7}$/.test(normalizeLoginPhone(value));

const phoneMatches = (stored = '', input = '') => {
  const storedPhone = normalizeLoginPhone(stored);
  const inputPhone = normalizeLoginPhone(input);
  return Boolean(storedPhone && inputPhone && storedPhone === inputPhone);
};

const getUserPhone = (user = {}) => (
  user.citizenProfile?.phone ||
  user.accountProfile?.phone ||
  user.phone ||
  ''
);

const findUserByPhone = async (phone) => {
  const normalizedPhone = normalizeLoginPhone(phone);
  if (!normalizedPhone) return null;
  const users = await prisma.user.findMany({
    include: { citizenProfile: true, accountProfile: true }
  });
  return users.find((user) => phoneMatches(getUserPhone(user), normalizedPhone)) || null;
};

const phoneAlreadyExists = async (phone) => Boolean(await findUserByPhone(phone));

const generatePendingLoginToken = (user) => jwt.sign(
  {
    type: 'pending_login_otp',
    userId: user.id,
    role: normalizeRole(user.role),
    phone: normalizeLoginPhone(accountValue(user, 'phone', user.phone))
  },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);

const normalizeProcessStatus = (value) => {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'ACTIVE') return 'COMPLETED';
  if (status === 'PENDING') return 'WAITING';
  if (status === 'NOT_ISSUED') return 'NOT_STARTED';
  return status || 'NOT_STARTED';
};

const getFullName = (user = {}) => {
  const citizen = user.citizenProfile || {};
  if (citizen.fullName) return String(citizen.fullName).trim();
  if (user.accountProfile?.name) return String(user.accountProfile.name).trim();
  const nameFromParts = [user.firstName, user.middleName, user.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return nameFromParts || String(user.name || '').trim();
};

const citizenValue = (user, key, fallback = '') => {
  const citizen = user?.citizenProfile || {};
  return citizen[key] ?? user?.[key] ?? fallback;
};

const accountValue = (user, key, fallback = '') => {
  const profile = user?.accountProfile || {};
  return profile[key] ?? user?.[key] ?? fallback;
};

const getCenterName = (center) => {
  if (!center || typeof center === 'string') return '';
  return center.name || '';
};

const attachCenter = async (user) => {
  if (!user?.center || typeof user.center !== 'string') return user;
  const center = await prisma.center.findUnique({
    where: { id: user.center },
    select: { id: true, name: true, address: true, city: true, district: true, phone: true, status: true }
  });
  if (!center) return user;
  return {
    ...user,
    center: { ...center, _id: center.id }
  };
};

const publicUserPayload = (user) => ({
  id: user.id,
  _id: user.id, // For backward compatibility with frontend
  name: getFullName(user) || user.name,
  firstName: citizenValue(user, 'firstName'),
  middleName: citizenValue(user, 'middleName'),
  lastName: citizenValue(user, 'lastName'),
  fullName: getFullName(user),
  username: user.username,
  email: normalizeRole(user.role) === 'citizen' ? citizenValue(user, 'email', user.email) : accountValue(user, 'email', user.email),
  phone: normalizeRole(user.role) === 'citizen' ? citizenValue(user, 'phone', user.phone) : accountValue(user, 'phone', user.phone),
  nationalId: citizenValue(user, 'nationalId'),
  nationalIdStatus: citizenValue(user, 'nationalIdStatus', 'NOT_STARTED'),
  cardSerialNumber: citizenValue(user, 'cardSerialNumber'),
  cardStatus: citizenValue(user, 'cardStatus', 'NOT_ISSUED'),
  cardIssueDate: citizenValue(user, 'cardIssueDate', null),
  cardExpiryDate: citizenValue(user, 'cardExpiryDate', null),
  replacementCount: citizenValue(user, 'replacementCount', 0),
  approvedRegistration: citizenValue(user, 'approvedRegistration', null),
  maritalStatus: citizenValue(user, 'maritalStatus'),
  dateOfBirth: citizenValue(user, 'dateOfBirth'),
  address: citizenValue(user, 'address'),
  role: normalizeRole(user.role),
  operatorType: accountValue(user, 'operatorType', user.operatorType),
  status: accountValue(user, 'status', user.status),
  center: accountValue(user, 'center', user.center),
  assignedDistrict: accountValue(user, 'assignedDistrict', user.assignedDistrict) || getCenterDistrict(accountValue(user, 'center', user.center)),
  mustChangePassword: accountValue(user, 'mustChangePassword', user.mustChangePassword),
  createdAt: user.createdAt,
  citizenSummary: {
    fullName: getFullName(user),
    nationalIdNumber: citizenValue(user, 'nationalId'),
    nationalIdStatus: normalizeProcessStatus(citizenValue(user, 'nationalIdStatus', 'NOT_STARTED')),
    maritalStatus: citizenValue(user, 'maritalStatus'),
    accountStatus: String(user.status || 'active').toUpperCase(),
    registrationDate: citizenValue(user, 'createdAt', user.createdAt),
    issueDate: citizenValue(user, 'cardIssueDate', null),
    expiryDate: citizenValue(user, 'cardExpiryDate', null),
    districtName: citizenValue(user, 'district', user.assignedDistrict || getCenterDistrict(user.center) || ''),
    centerName: getCenterName(user.center)
  }
});

const usernameFrom = (value) => String(value || '').trim().toLowerCase();
const USERNAME_RULE_MESSAGE = 'Username may contain letters, numbers, dots, underscores, and hyphens.';
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include letters, numbers, and a special character.';

const isValidUsername = (value) => /^[A-Za-z0-9._-]+$/.test(String(value || ''));
const isStrongPassword = (value) => /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(value || ''));

const createActiveSession = async ({ ip, userAgent, user, tokenId }) => {
  await prisma.activeSession.updateMany({
    where: { user: user.id, status: 'active' },
    data: {
      status: 'inactive',
      loggedOutAt: new Date(),
      lastActiveTime: new Date()
    }
  });

  await prisma.activeSession.create({
    data: {
      user: user.id,
      tokenId,
      username: user.username,
      role: normalizeRole(user.role),
      ipAddress: ip || '127.0.0.1',
      userAgent: userAgent || 'Unknown device'
    }
  });
};

const matchPassword = async (enteredPassword, userPassword) => {
  return await bcrypt.compare(enteredPassword, userPassword);
};

const assertCanLogin = (user) => {
  if (isStaffCenterRole(user.role) && !isActiveAccountStatus(user.status)) {
    const accountStatus = normalizeAccountStatus(user.status);
    const message = accountStatus === 'pending_approval'
      ? ERRORS.OPERATOR_NOT_APPROVED
      : accountStatus === 'rejected'
        ? 'This operator account was rejected by the Super Admin.'
        : 'This operator account is inactive. Contact the administrator.';
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }

  if (isStaffCenterRole(user.role) && !user.center) {
    const error = new Error('This operator account is not assigned to a service center.');
    error.statusCode = 403;
    throw error;
  }
};

const completeLogin = async (ip, userAgent, user) => {
  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: now },
    include: { citizenProfile: true, accountProfile: true }
  });
  await prisma.accountProfile.updateMany({
    where: { userId: user.id },
    data: { lastActiveAt: now }
  });

  await prisma.auditLog.create({
    data: {
      user: user.id,
      role: normalizeRole(user.role),
      action: 'Login',
      details: `User signed in: ${user.username}`,
      ipAddress: ip || '127.0.0.1',
    }
  });

  const { token, tokenId } = generateToken(updatedUser.id, updatedUser.role);
  await createActiveSession({ ip, userAgent, user: updatedUser, tokenId });
  const responseUser = await attachCenter(updatedUser);

  return {
    token,
    user: publicUserPayload(responseUser)
  };
};

const getPendingLoginUser = async (loginToken) => {
  let payload;
  try {
    payload = jwt.verify(loginToken, process.env.JWT_SECRET);
  } catch {
    const error = new Error('Login OTP session expired. Please sign in again.');
    error.statusCode = 401;
    throw error;
  }

  if (payload.type !== 'pending_login_otp' || !payload.userId) {
    const error = new Error('Invalid login OTP session.');
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { citizenProfile: true, accountProfile: true } });
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  if (payload.phone && user.phone && payload.phone !== normalizeLoginPhone(user.phone)) {
    const error = new Error('Login OTP session does not match this account.');
    error.statusCode = 401;
    throw error;
  }

  assertCanLogin(user);
  return user;
};

export class AuthService {
  static async registerUser({ body, ip, userAgent }) {
    try {
      const { username, password, phone, name, email } = body;
      const displayName = String(name || username || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const suggestedFromEmail = cleanEmail.includes('@')
        ? cleanEmail.split('@')[0]
        : '';
      const rawUsernameSource = String(
        username || suggestedFromEmail || displayName.replace(/\s+/g, '_') || ''
      );
      const cleanUsername = usernameFrom(rawUsernameSource);
      const cleanPhone = normalizeLoginPhone(phone);

      if (!cleanUsername) {
        throw { statusCode: 400, message: 'Full name or email is required.' };
      }
      if (cleanPhone && !isValidSomaliLoginPhone(cleanPhone)) {
        throw { statusCode: 400, message: 'Enter a valid Somali phone number.' };
      }
      if (!password) {
        throw { statusCode: 400, message: 'Password is required.' };
      }
      if (cleanUsername.length < 3) {
        throw { statusCode: 400, message: 'Username must be at least 3 characters.' };
      }
      if (!isStrongPassword(password)) {
        throw { statusCode: 400, message: PASSWORD_RULE_MESSAGE };
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw { statusCode: 400, message: 'Enter a valid email address.' };
      }

      const userExists = await prisma.user.findUnique({
        where: { username: cleanUsername }
      });

      if (userExists) {
        throw { statusCode: 400, message: 'This account username is already in use. Try another email/name.' };
      }
      if (cleanPhone && await phoneAlreadyExists(cleanPhone)) {
        throw { statusCode: 400, message: 'This phone number is already in use.' };
      }
      if (cleanEmail) {
        const emailExists = await prisma.user.findFirst({ where: { email: cleanEmail } });
        if (emailExists) {
          throw { statusCode: 400, message: 'This email is already in use.' };
        }
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userRole = 'citizen';
      const permanentNqsId = await generatePermanentNqsId();
      const citizenName = displayName || cleanUsername;

      const user = await prisma.user.create({
        data: {
          name: citizenName,
          username: cleanUsername,
          email: cleanEmail || null,
          phone: cleanPhone || '',
          nationalId: permanentNqsId,
          password: hashedPassword,
          role: userRole,
          citizenProfile: {
            create: {
              fullName: citizenName,
              phone: cleanPhone || '',
              nationalId: permanentNqsId
            }
          }
        },
        include: {
          citizenProfile: true
        }
      });

      if (user) {
        await prisma.auditLog.create({
          data: {
            user: user.id,
            role: userRole,
            action: 'User Registration',
            details: `Registered citizen account for username: ${cleanUsername}`,
            ipAddress: ip || '127.0.0.1'
          }
        });

        const { token, tokenId } = generateToken(user.id, user.role);
        await createActiveSession({ ip, userAgent, user, tokenId });

        return {
          token,
          user: publicUserPayload(user)
        };
      } else {
        throw { statusCode: 400, message: 'Invalid user data' };
      }
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        throw { statusCode: 400, message: 'This username is already in use.' };
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('phone')) {
        throw { statusCode: 400, message: 'This phone number is already in use.' };
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw { statusCode: 400, message: 'This email is already in use.' };
      }
      throw error;
    }
  }

  static async loginUser({ body, ip, userAgent }) {
    try {
      const { username, identifier: bodyIdentifier, login, password } = body;
      const rawIdentifier = String(username || bodyIdentifier || login || '').trim();
      const identifier = usernameFrom(rawIdentifier);
      const phoneIdentifier = normalizeLoginPhone(rawIdentifier);

      if (!identifier) {
        throw { statusCode: 401, message: 'Username or phone number is required.' };
      }
      if (!password) {
        throw { statusCode: 401, message: 'Invalid password.' };
      }

      let user = await prisma.user.findUnique({
        where: { username: identifier },
        include: { citizenProfile: true, accountProfile: true }
      });
      if (!user && phoneIdentifier) {
        user = await findUserByPhone(phoneIdentifier);
      }

      if (!user) {
        throw { statusCode: 401, message: 'Username or phone number not found. Please register first.' };
      }

      if (!(await matchPassword(password, user.password))) {
        await prisma.auditLog.create({
          data: {
            user: user.id,
            role: normalizeRole(user.role),
            action: 'Login Failed',
            details: `Failed authentication attempt for identifier: ${rawIdentifier}`,
            ipAddress: ip || '127.0.0.1',
          }
        });
        throw { statusCode: 401, message: 'Invalid password.' };
      }

      user = await normalizeUserRole(user);
      
      const updateData = {};
      if (isStaffCenterRole(user.role) && !user.assignedDistrict && getCenterDistrict(user.center)) {
        updateData.assignedDistrict = getCenterDistrict(user.center);
        user.assignedDistrict = updateData.assignedDistrict;
      }
      
      assertCanLogin(user);

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }

      const userRole = normalizeRole(user.role);
      const loginOtpRole = getLoginOtpRole(userRole);
      if (LOGIN_OTP_ROLES.has(loginOtpRole)) {
        if (!user.phone) {
          throw { statusCode: 400, message: 'No phone number is assigned to this account.' };
        }

        const otpData = await requestOtp({
          purpose: 'login',
          phone: user.phone,
          userId: user.id,
          forceNew: true
        });

        await prisma.auditLog.create({
          data: {
            user: user.id,
            role: userRole,
            action: 'Login OTP Sent',
            details: `Login OTP sent for username: ${user.username}`,
            ipAddress: ip || '127.0.0.1',
          }
        });

        return {
          otpRequired: true,
          purpose: 'login',
          phone: otpData.phone,
          otpId: otpData.otpId,
          loginToken: generatePendingLoginToken(user),
          role: loginOtpRole
        };
      }

      return await completeLogin(ip, userAgent, user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static async verifyLoginOtp({ body, ip, userAgent }) {
    try {
      const { loginToken, code, otpId } = body;
      const user = await getPendingLoginUser(loginToken);
      const normalizedCode = String(code || '').replace(/\D/g, '');

      await verifyOtp({
        purpose: 'login',
        phone: user.phone,
        code: normalizedCode,
        otpId,
        userId: user.id,
        allowLoginFallback: true
      });

      return await completeLogin(ip, userAgent, user);
    } catch (error) {
      throw error;
    }
  }

  static async resendLoginOtp({ body }) {
    try {
      const user = await getPendingLoginUser(body.loginToken);
      const data = await requestOtp({
        purpose: 'login',
        phone: user.phone,
        userId: user.id,
        forceNew: true
      });

      return data;
    } catch (error) {
      throw error;
    }
  }

  static async getUserProfile({ user }) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, include: { citizenProfile: true, accountProfile: true } });

    if (dbUser) {
      await normalizeUserRole(dbUser);
      const responseUser = await attachCenter(dbUser);
      return publicUserPayload(responseUser);
    } else {
      throw { statusCode: 404, message: 'User not found' };
    }
  }

  static async updateUserProfile({ body, user, ip }) {
    try {
      const { name, email, phone, nationalId, dateOfBirth, address } = body;
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, include: { citizenProfile: true, accountProfile: true } });

      if (!dbUser) {
        throw { statusCode: 404, message: 'User not found' };
      }

      if (email && email !== dbUser.email) {
        const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: dbUser.id } } });
        if (emailTaken) {
          throw { statusCode: 400, message: 'Email is already in use' };
        }
      }
      if (phone) {
        const phoneOwner = await findUserByPhone(phone);
        if (phoneOwner && phoneOwner.id !== dbUser.id) {
          throw { statusCode: 400, message: 'This phone number is already in use.' };
        }
      }

      const updateData = {
        name: name || dbUser.name,
        email: email === '' ? null : (email || dbUser.email),
        phone: phone || dbUser.phone,
        dateOfBirth: dateOfBirth ?? dbUser.dateOfBirth,
        address: address ?? dbUser.address,
        role: normalizeRole(dbUser.role)
      };

      if (normalizeRole(dbUser.role) !== 'citizen') {
        updateData.nationalId = nationalId ?? dbUser.nationalId;
      } else if (nationalId && String(nationalId).trim() !== String(dbUser.citizenProfile?.nationalId || dbUser.nationalId || '').trim()) {
        throw {
          statusCode: 400,
          message: 'National ID number cannot be changed. Each citizen keeps one permanent ID.'
        };
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: updateData,
        include: { citizenProfile: true, accountProfile: true }
      });

      if (normalizeRole(updatedUser.role) === 'citizen') {
        const fullName = name || getFullName(updatedUser) || updatedUser.username;
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
        const lockedNationalId = dbUser.citizenProfile?.nationalId || dbUser.nationalId || updatedUser.nationalId || '';
        const citizenData = {
          fullName,
          firstName: parts[0] || '',
          middleName: parts.slice(1, -1).join(' '),
          lastName: parts.length > 1 ? parts[parts.length - 1] : '',
          email: email === '' ? null : (email || updatedUser.email),
          phone: phone || updatedUser.phone || '',
          nationalId: lockedNationalId,
          dateOfBirth: dateOfBirth ?? updatedUser.dateOfBirth ?? '',
          address: address ?? updatedUser.address ?? '',
          district: updatedUser.district || '',
          maritalStatus: updatedUser.maritalStatus || ''
        };
        await prisma.citizen.upsert({
          where: { userId: updatedUser.id },
          update: citizenData,
          create: { userId: updatedUser.id, ...citizenData }
        });
        updatedUser.citizenProfile = await prisma.citizen.findUnique({ where: { userId: updatedUser.id } });
      }

      await prisma.auditLog.create({
        data: {
          user: updatedUser.id,
          role: normalizeRole(updatedUser.role),
          action: 'Update Profile',
          details: `Updated profile details${nationalId || dateOfBirth || address ? ' with extended citizen fields' : ''}`,
          ipAddress: ip || '127.0.0.1',
        }
      });

      return publicUserPayload(updatedUser);
    } catch (error) {
      throw error;
    }
  }

  static async changePassword({ body, user, ip }) {
    try {
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        throw { statusCode: 400, message: 'Current and new password are required' };
      }

      if (String(newPassword).length < 8) {
        throw { statusCode: 400, message: 'New password must be at least 8 characters.' };
      }

      if (String(currentPassword) === String(newPassword)) {
        throw { statusCode: 400, message: 'New password must be different from the current password.' };
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) {
        throw { statusCode: 404, message: 'User not found' };
      }

      if (!dbUser.password) {
        throw { statusCode: 400, message: 'Current password is incorrect' };
      }

      const matches = await matchPassword(String(currentPassword), dbUser.password);
      if (!matches) {
        throw { statusCode: 400, message: 'Current password is incorrect' };
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(String(newPassword), salt);

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false
        }
      });

      await prisma.auditLog.create({
        data: {
          user: dbUser.id,
          role: normalizeRole(dbUser.role),
          action: 'Change Password',
          details: 'Updated account password',
          ipAddress: ip || '127.0.0.1',
        }
      });

      return { message: 'Password updated.' };
    } catch (error) {
      throw error;
    }
  }

  static async deleteUserAccount({ user, ip }) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

      if (!dbUser) {
        throw { statusCode: 404, message: 'User not found' };
      }

      await prisma.auditLog.create({
        data: {
          user: dbUser.id,
          role: normalizeRole(dbUser.role),
          action: 'Delete Account',
          details: `Deleted account for username: ${dbUser.username}`,
          ipAddress: ip || '127.0.0.1',
        }
      });

      await prisma.user.delete({ where: { id: dbUser.id } });

      return { message: 'Account deleted.' };
    } catch (error) {
      throw error;
    }
  }

  static async logoutUser({ tokenId, user, req }) {
    try {
      const loggedOutAt = new Date();
      if (tokenId) {
        await prisma.activeSession.updateMany({
          where: { tokenId, status: 'active' },
          data: { status: 'inactive', loggedOutAt, lastActiveTime: loggedOutAt }
        });
      }
      if (user?.id) {
        await prisma.activeSession.updateMany({
          where: { user: user.id, status: 'active' },
          data: { status: 'inactive', loggedOutAt, lastActiveTime: loggedOutAt }
        });
      }
      await logActivity({
        req,
        action: 'Logout',
        details: `User signed out: ${user?.username || user?.id || 'unknown'}`
      });
      return { message: 'Logged out.' };
    } catch (error) {
      return { message: 'Logged out.' };
    }
  }
}
