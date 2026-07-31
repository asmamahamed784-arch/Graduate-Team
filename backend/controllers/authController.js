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

const createActiveSession = async ({ req, user, tokenId }) => {
  // One live session per user — close any previous active rows for this account.
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
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.get('user-agent') || 'Unknown device'
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

const completeLogin = async (req, res, user) => {
  await prisma.auditLog.create({
    data: {
      user: user.id,
      role: normalizeRole(user.role),
      action: 'Login',
      details: `User signed in: ${user.username}`,
      ipAddress: req.ip || '127.0.0.1',
    }
  });

  const { token, tokenId } = generateToken(user.id, user.role);
  await createActiveSession({ req, user, tokenId });
  const responseUser = await attachCenter(user);

  return res.json({
    success: true,
    data: {
      token,
      user: publicUserPayload(responseUser)
    }
  });
};

export const registerUser = async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    const rawUsername = String(username || '');
    const cleanUsername = usernameFrom(username);
    const cleanPhone = normalizeLoginPhone(phone);

    if (!cleanUsername) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (cleanPhone && !isValidSomaliLoginPhone(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid Somali phone number.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (rawUsername !== rawUsername.trim() || !isValidUsername(rawUsername)) {
      return res.status(400).json({ success: false, message: USERNAME_RULE_MESSAGE });
    }
    if (cleanUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_RULE_MESSAGE });
    }

    const userExists = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'This username is already in use.' });
    }
    if (cleanPhone && await phoneAlreadyExists(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userRole = 'citizen';
    const permanentNqsId = await generatePermanentNqsId();

    const user = await prisma.user.create({
      data: {
        name: cleanUsername,
        username: cleanUsername,
        phone: cleanPhone || '',
        nationalId: permanentNqsId,
        password: hashedPassword,
        role: userRole,
        citizenProfile: {
          create: {
            fullName: cleanUsername,
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
          ipAddress: req.ip || '127.0.0.1'
        }
      });

      const { token, tokenId } = generateToken(user.id, user.role);
      await createActiveSession({ req, user, tokenId });

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: publicUserPayload(user)
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
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

export const loginUser = async (req, res) => {
  try {
    const { username, identifier: bodyIdentifier, login, password } = req.body;
    const rawIdentifier = String(username || bodyIdentifier || login || '').trim();
    const identifier = usernameFrom(rawIdentifier);
    const phoneIdentifier = normalizeLoginPhone(rawIdentifier);

    if (!identifier) {
      return res.status(401).json({ success: false, message: 'Username or phone number is required.' });
    }
    if (!password) {
      return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    let user = await prisma.user.findUnique({
      where: { username: identifier },
      include: { citizenProfile: true, accountProfile: true }
    });
    if (!user && phoneIdentifier) {
      user = await findUserByPhone(phoneIdentifier);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username or phone number not found. Please register first.' });
    }

    if (!(await matchPassword(password, user.password))) {
      await prisma.auditLog.create({
        data: {
          user: user.id,
          role: normalizeRole(user.role),
          action: 'Login Failed',
          details: `Failed authentication attempt for identifier: ${rawIdentifier}`,
          ipAddress: req.ip || '127.0.0.1',
        }
      });
      return res.status(401).json({ success: false, message: 'Invalid password.' });
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
        return res.status(400).json({ success: false, message: 'No phone number is assigned to this account.' });
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
          ipAddress: req.ip || '127.0.0.1',
        }
      });

      return res.json({
        success: true,
        data: {
          otpRequired: true,
          purpose: 'login',
          phone: otpData.phone,
          otpId: otpData.otpId,
          loginToken: generatePendingLoginToken(user),
          role: loginOtpRole
        }
      });
    }

    return completeLogin(req, res, user);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message, retryAfter: error.retryAfter });
  }
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

export const verifyLoginOtp = async (req, res) => {
  try {
    const { loginToken, code, otpId } = req.body;
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

    return completeLogin(req, res, user);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      attemptsRemaining: error.attemptsRemaining,
      newOtpSent: error.newOtpSent
    });
  }
};

export const resendLoginOtp = async (req, res) => {
  try {
    const user = await getPendingLoginUser(req.body.loginToken);
    const data = await requestOtp({
      purpose: 'login',
      phone: user.phone,
      userId: user.id,
      forceNew: true
    });

    return res.json({ success: true, message: 'OTP sent.', data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      retryAfter: error.retryAfter
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { citizenProfile: true, accountProfile: true } });

    if (user) {
      await normalizeUserRole(user);
      const responseUser = await attachCenter(user);
      return res.json({
        success: true,
        data: publicUserPayload(responseUser)
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, email, phone, nationalId, dateOfBirth, address } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { citizenProfile: true, accountProfile: true } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (email && email !== user.email) {
      const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: user.id } } });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
    }
    if (phone) {
      const phoneOwner = await findUserByPhone(phone);
      if (phoneOwner && phoneOwner.id !== user.id) {
        return res.status(400).json({ success: false, message: 'This phone number is already in use.' });
      }
    }

    const updateData = {
      name: name || user.name,
      email: email === '' ? null : (email || user.email),
      phone: phone || user.phone,
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      address: address ?? user.address,
      role: normalizeRole(user.role)
    };

    // Citizens keep one permanent National ID — profile updates cannot change it.
    if (normalizeRole(user.role) !== 'citizen') {
      updateData.nationalId = nationalId ?? user.nationalId;
    } else if (nationalId && String(nationalId).trim() !== String(user.citizenProfile?.nationalId || user.nationalId || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'National ID number cannot be changed. Each citizen keeps one permanent ID.'
      });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { citizenProfile: true, accountProfile: true }
    });

    if (normalizeRole(updatedUser.role) === 'citizen') {
      const fullName = name || getFullName(updatedUser) || updatedUser.username;
      const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
      const lockedNationalId = user.citizenProfile?.nationalId || user.nationalId || updatedUser.nationalId || '';
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
        ipAddress: req.ip || '127.0.0.1',
      }
    });

    return res.json({
      success: true,
      data: publicUserPayload(updatedUser)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await matchPassword(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: normalizeRole(user.role),
        action: 'Change Password',
        details: 'Updated account password',
        ipAddress: req.ip || '127.0.0.1',
      }
    });

    return res.json({ success: true, message: 'Password updated.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUserAccount = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: normalizeRole(user.role),
        action: 'Delete Account',
        details: `Deleted account for username: ${user.username}`,
        ipAddress: req.ip || '127.0.0.1',
      }
    });

    await prisma.user.delete({ where: { id: user.id } });

    return res.json({ success: true, message: 'Account deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    if (req.tokenId) {
      await prisma.activeSession.update({
        where: { tokenId: req.tokenId },
        data: { status: 'inactive', loggedOutAt: new Date(), lastActiveTime: new Date() }
      });
    }
    await logActivity({
      req,
      action: 'Logout',
      details: `User signed out: ${req.user?.username || req.user?.id || 'unknown'}`
    });
    return res.json({ success: true, message: 'Logged out.' });
  } catch (error) {
    return res.json({ success: true, message: 'Logged out.' });
  }
};
