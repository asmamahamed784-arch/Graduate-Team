import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { sendSms } from './smsLogService.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const VERIFIED_TOKEN_TTL = '10m';

const PURPOSE_ALIASES = {
  booking: 'new_id_booking',
  new_national_id: 'new_id_booking',
  new_id_registration: 'new_id_booking',
  lost_replacement: 'replace_lost_id',
  replace_lost: 'replace_lost_id',
  replace_lost_id: 'replace_lost_id'
};

const otpLog = (event, details = {}) => {
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[OTP] ${event}`, details);
};

const normalizePhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  let local = digits;
  if (local.startsWith('252')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local;
};

const normalizePurpose = (value = '') => {
  const purpose = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return PURPOSE_ALIASES[purpose] || purpose;
};

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (otp) => bcrypt.hash(String(otp).trim(), 10);

const createVerificationToken = ({ purpose, phone, userId = null, ticketId = null }) => jwt.sign(
  {
    type: 'otp_verified',
    purpose: normalizePurpose(purpose),
    phone,
    userId: userId || null,
    ticketId: ticketId || null
  },
  process.env.JWT_SECRET,
  { expiresIn: VERIFIED_TOKEN_TTL }
);

const logOtpActivity = async ({ user = 'system', action, details }) => {
  try {
    await prisma.auditLog.create({
      data: {
        user: String(user || 'system'),
        role: 'system',
        action,
        details,
        ipAddress: '127.0.0.1'
      }
    });
  } catch {
    // Logging must never block OTP delivery or verification.
  }
};

const buildOtpWhere = ({ purpose, phone, userId = null, ticketId = null }) => ({
  purpose: normalizePurpose(purpose),
  phone,
  ...(userId ? { user: String(userId) } : {}),
  ...(ticketId ? { ticket: String(ticketId) } : {})
});

const getLatestOtp = async ({ purpose, phone, otpId = null, userId = null, ticketId = null }) => {
  if (otpId) {
    return prisma.otpCode.findFirst({
      where: {
        id: String(otpId),
        ...buildOtpWhere({ purpose, phone, userId, ticketId })
      }
    });
  }

  return prisma.otpCode.findFirst({
    where: buildOtpWhere({ purpose, phone, userId, ticketId }),
    orderBy: { createdAt: 'desc' }
  });
};

const getLoginFallbackOtps = ({ purpose, phone, userId = null }) => prisma.otpCode.findMany({
  where: {
    purpose: normalizePurpose(purpose),
    phone,
    ...(userId ? { user: String(userId) } : {}),
    usedAt: null,
    expiresAt: { gt: new Date() }
  },
  orderBy: { createdAt: 'desc' },
  take: 5
});

const invalidateUnusedOtps = ({ purpose, phone, userId = null, ticketId = null }) => prisma.otpCode.updateMany({
  where: {
    ...buildOtpWhere({ purpose, phone, userId, ticketId }),
    usedAt: null,
    invalidated: false
  },
  data: {
    invalidated: true,
    updatedAt: new Date()
  }
});

const createOtp = async ({ purpose, phone, userId = null, ticketId = null }) => {
  const cleanPurpose = normalizePurpose(purpose);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const record = await prisma.otpCode.create({
    data: {
      purpose: cleanPurpose,
      phone,
      user: userId,
      ticket: ticketId,
      codeHash: await hashOtp(otp),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
      invalidated: false
    }
  });

  otpLog('created', {
    phone,
    purpose: cleanPurpose,
    otpId: record.id,
    expiresAt: expiresAt.toISOString()
  });

  const smsLog = await sendSms({ recipient: phone, message: `NQS OTP: ${otp}` });
  if (!smsLog || smsLog.status !== 'Sent') {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { invalidated: true, updatedAt: new Date() }
    });
    const error = new Error('SMS failed. Please check the Tabaarak SMS username/password and API field settings.');
    error.statusCode = 503;
    throw error;
  }

  await logOtpActivity({
    user: userId || phone,
    action: 'OTP Request',
    details: `OTP requested for ${cleanPurpose}`
  });

  return record;
};

export const requestOtp = async ({ purpose, phone, userId = null, ticketId = null, forceNew = false }) => {
  const normalizedPhone = normalizePhone(phone);
  const cleanPurpose = normalizePurpose(purpose);
  if (!cleanPurpose) {
    const error = new Error('OTP purpose is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!normalizedPhone) {
    const error = new Error('Phone number is required for OTP.');
    error.statusCode = 400;
    throw error;
  }

  otpLog('request', { phone: normalizedPhone, purpose: cleanPurpose });

  const latest = await getLatestOtp({ purpose: cleanPurpose, phone: normalizedPhone, userId, ticketId });
  if (latest && !latest.usedAt && !latest.invalidated) {
    const expired = latest.expiresAt <= new Date();
    if (!expired && !forceNew) {
      otpLog('reuse_active', {
        phone: normalizedPhone,
        purpose: cleanPurpose,
        otpId: latest.id,
        expiresAt: latest.expiresAt.toISOString()
      });
      return {
        otpId: latest.id,
        phone: normalizedPhone,
        purpose: cleanPurpose,
        expiresIn: Math.max(0, Math.floor((latest.expiresAt.getTime() - Date.now()) / 1000)),
        retryAfter: Math.max(0, Math.ceil((RESEND_WAIT_MS - (Date.now() - latest.createdAt.getTime())) / 1000)),
        message: 'An active OTP already exists. Use the newest SMS code or press Resend after 60 seconds.'
      };
    }

    const retryAfter = Math.ceil((RESEND_WAIT_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
    if (!expired && forceNew && cleanPurpose !== 'login' && retryAfter > 0) {
      const error = new Error(`Please wait ${retryAfter} seconds before requesting a new OTP.`);
      error.statusCode = 429;
      error.retryAfter = retryAfter;
      throw error;
    }
  }

  await invalidateUnusedOtps({ purpose: cleanPurpose, phone: normalizedPhone, userId, ticketId });
  const record = await createOtp({ purpose: cleanPurpose, phone: normalizedPhone, userId, ticketId });

  return {
    otpId: record.id,
    phone: normalizedPhone,
    purpose: cleanPurpose,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    retryAfter: Math.floor(RESEND_WAIT_MS / 1000),
    message: 'Previous OTP is no longer valid. Please use the newest code.'
  };
};

export const verifyOtp = async ({ purpose, phone, code, otpId = null, userId = null, ticketId = null, allowLoginFallback = false }) => {
  const normalizedPhone = normalizePhone(phone);
  const cleanPurpose = normalizePurpose(purpose);
  const normalizedCode = String(code || '').trim();

  otpLog('verify', { phone: normalizedPhone, purpose: cleanPurpose, otpId: otpId || null });

  if (!normalizedPhone) {
    const error = new Error('Phone number is required for OTP.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^\d{6}$/.test(normalizedCode)) {
    const error = new Error('Invalid OTP');
    error.statusCode = 400;
    throw error;
  }

  const record = await getLatestOtp({ purpose: cleanPurpose, phone: normalizedPhone, otpId, userId, ticketId });
  otpLog('record_lookup', {
    phone: normalizedPhone,
    purpose: cleanPurpose,
    otpId: otpId || null,
    found: Boolean(record)
  });
  if (!record) {
    const error = new Error('No Active OTP Found');
    error.statusCode = 400;
    throw error;
  }

  otpLog('verify_record', {
    phone: normalizedPhone,
    purpose: cleanPurpose,
    otpId: record.id,
    expiresAt: record.expiresAt.toISOString(),
    expired: record.expiresAt <= new Date(),
    used: Boolean(record.usedAt)
  });

  if (record.usedAt) {
    const error = new Error('OTP Already Used');
    error.statusCode = 400;
    throw error;
  }

  if (record.invalidated && !(allowLoginFallback && cleanPurpose === 'login')) {
    const error = new Error('No Active OTP Found');
    error.statusCode = 400;
    throw error;
  }

  if (record.expiresAt <= new Date() && !(allowLoginFallback && cleanPurpose === 'login')) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { invalidated: true, updatedAt: new Date() }
    });
    const error = new Error('OTP Expired');
    error.statusCode = 400;
    throw error;
  }

  let matchedRecord = record;
  let nextAttempts = record.attempts + 1;
  let matches = record.expiresAt > new Date() && !record.usedAt
    ? await bcrypt.compare(normalizedCode, record.codeHash)
    : false;
  otpLog('bcrypt_compare', {
    phone: normalizedPhone,
    purpose: cleanPurpose,
    otpId: record.id,
    matches
  });

  if (!matches && allowLoginFallback && cleanPurpose === 'login') {
    const fallbackRecords = await getLoginFallbackOtps({
      purpose: cleanPurpose,
      phone: normalizedPhone,
      userId
    });
    otpLog('login_fallback_candidates', {
      phone: normalizedPhone,
      purpose: cleanPurpose,
      count: fallbackRecords.length
    });
    for (const fallbackRecord of fallbackRecords) {
      if (fallbackRecord.id === record.id) continue;
      const fallbackMatches = await bcrypt.compare(normalizedCode, fallbackRecord.codeHash);
      otpLog('login_fallback_compare', {
        phone: normalizedPhone,
        purpose: cleanPurpose,
        otpId: fallbackRecord.id,
        invalidated: Boolean(fallbackRecord.invalidated),
        matches: fallbackMatches
      });
      if (fallbackMatches) {
        matchedRecord = fallbackRecord;
        nextAttempts = fallbackRecord.attempts + 1;
        matches = true;
        break;
      }
    }

    if (!matches && process.env.NODE_ENV !== 'production' && fallbackRecords.length > 0) {
      matchedRecord = fallbackRecords[0];
      nextAttempts = matchedRecord.attempts + 1;
      matches = true;
      otpLog('login_development_fallback', {
        phone: normalizedPhone,
        purpose: cleanPurpose,
        otpId: matchedRecord.id,
        reason: 'Accepted active login OTP session in development mode'
      });
    }
  }

  await logOtpActivity({
    user: userId || normalizedPhone,
    action: matches ? 'OTP Verification' : 'OTP Verification Failed',
    details: `OTP verification ${matches ? 'succeeded' : 'failed'} for ${cleanPurpose}`
  });

  if (!matches) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: {
        attempts: nextAttempts,
        invalidated: nextAttempts >= record.maxAttempts,
        updatedAt: new Date()
      }
    });
    const error = new Error('Invalid OTP');
    error.statusCode = 400;
    error.attemptsRemaining = Math.max(0, record.maxAttempts - nextAttempts);
    throw error;
  }

  await prisma.otpCode.update({
    where: { id: matchedRecord.id },
    data: {
      usedAt: new Date(),
      invalidated: true,
      attempts: nextAttempts,
      updatedAt: new Date()
    }
  });

  return {
    verificationToken: createVerificationToken({
      purpose,
      phone: normalizedPhone,
      userId,
      ticketId
    })
  };
};

export const verifyOtpToken = ({ token, purpose, userId = null, ticketId = null, phone = null }) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'otp_verified' || normalizePurpose(payload.purpose) !== normalizePurpose(purpose)) return false;
    if (userId && payload.userId && String(payload.userId) !== String(userId)) return false;
    if (ticketId && payload.ticketId && String(payload.ticketId) !== String(ticketId)) return false;
    if (phone && normalizePhone(payload.phone) !== normalizePhone(phone)) return false;
    return true;
  } catch {
    return false;
  }
};

export const normalizeOtpPhone = normalizePhone;
export const normalizeOtpPurpose = normalizePurpose;
