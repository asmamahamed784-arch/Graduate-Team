import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { normalizeOtpPhone, normalizeOtpPurpose, requestOtp, verifyOtp, verifyOtpToken } from '../services/otpService.js';
import { logActivity } from '../utils/activityLogger.js';

const ALLOWED_PURPOSES = new Set([
  'new_id_booking',
  'update_information',
  'replace_lost_id',
  'complete_service',
  'cancel_service',
  'forgot_password'
]);
const TICKET_PHONE_PURPOSES = new Set(['complete_service', 'cancel_service']);
const UPDATE_BLOCKED_OTP_PURPOSES = new Set(['new_id_booking', 'update_information', 'replace_lost_id']);
const OPEN_UPDATE_STATUSES = ['Pending', 'On Hold', 'Waiting', 'Being Served', 'In Progress'];
const OPEN_UPDATE_REQUEST_STATUSES = ['Pending', 'Under Review', 'Approved', 'In Progress', 'Resubmission Required'];
const UPDATE_REQUEST_BLOCKS_OTHER_SERVICES_MESSAGE = 'You already have an Update Information request waiting for review. You cannot submit another request until that update is completed.';

// Prefer body phone (booking form) — citizen accounts may have no profile phone.
const getUserOtpPhone = (req) => normalizeOtpPhone(req.body.phone || req.user?.phone);

const phoneLookupVariants = (phone = '') => {
  const normalized = normalizeOtpPhone(phone);
  const digits = String(phone || '').replace(/\D/g, '');
  const localFromDigits = digits.startsWith('252') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return [...new Set([
    phone,
    normalized,
    digits,
    localFromDigits,
    `252${normalized}`,
    `+252${normalized}`,
    `0${normalized}`
  ].filter(Boolean))];
};

const resolveForgotPasswordUser = async ({ identifier = '', phone = '', userId = '' } = {}) => {
  if (userId) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  const cleanIdentifier = String(identifier || '').trim().toLowerCase();
  if (cleanIdentifier) {
    const phoneVariants = phoneLookupVariants(cleanIdentifier);
    return prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanIdentifier },
          { phone: { in: phoneVariants } }
        ]
      }
    });
  }

  if (phone) {
    return prisma.user.findFirst({ where: { phone: { in: phoneLookupVariants(phone) } } });
  }

  return null;
};

const getTicketPhone = async (ticketId) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  const user = ticket.citizen ? await prisma.user.findUnique({ where: { id: ticket.citizen } }) : null;
  return {
    ticket,
    phone: normalizeOtpPhone(
      ticket.registrationDetails?.phone ||
      ticket.updateDetails?.phone ||
      ticket.replacementDetails?.phone ||
      user?.phone
    )
  };
};

const findOpenUpdateRequestForCitizen = async (citizenId) => prisma.ticket.findFirst({
  where: {
    citizen: citizenId,
    requestType: 'update_information',
    OR: [
      { status: { in: OPEN_UPDATE_STATUSES } },
      { requestStatus: { in: OPEN_UPDATE_REQUEST_STATUSES } }
    ]
  },
  orderBy: { createdAt: 'desc' }
});

export const requestOtpCode = async (req, res) => {
  try {
    const { purpose, ticketId } = req.body;
    const cleanPurpose = normalizeOtpPurpose(purpose);
    if (!ALLOWED_PURPOSES.has(cleanPurpose)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose.' });
    }

    if (cleanPurpose === 'forgot_password') {
      return res.status(400).json({ success: false, message: 'Use forgot password OTP endpoint.' });
    }

    if (req.user?.id && String(req.user?.role || '').toLowerCase() === 'citizen' && UPDATE_BLOCKED_OTP_PURPOSES.has(cleanPurpose)) {
      const openUpdateRequest = await findOpenUpdateRequestForCitizen(req.user.id);
      if (openUpdateRequest) {
        return res.status(409).json({
          success: false,
          message: cleanPurpose === 'update_information'
            ? 'You already have a pending Update Information request. Please wait until the Center or Admin completes it.'
            : UPDATE_REQUEST_BLOCKS_OTHER_SERVICES_MESSAGE,
          data: openUpdateRequest
        });
      }
    }

    let phone = getUserOtpPhone(req);
    if (TICKET_PHONE_PURPOSES.has(cleanPurpose)) {
      const ticketData = await getTicketPhone(ticketId);
      if (!ticketData?.ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
      phone = ticketData.phone;
    }

    if (cleanPurpose === 'new_id_booking' && phone) {
      const existingUser = await prisma.user.findFirst({
        where: { phone: { in: phoneLookupVariants(phone) } }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'This phone number is already in use, so an OTP was not sent.' });
      }
    }

    const data = await requestOtp({
      purpose: cleanPurpose,
      phone,
      userId: req.user?.id,
      ticketId: TICKET_PHONE_PURPOSES.has(cleanPurpose) ? ticketId : null,
      forceNew: req.body.resend === true
    });

    return res.json({ success: true, message: 'OTP sent.', data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      retryAfter: error.retryAfter,
      attemptsRemaining: error.attemptsRemaining
    });
  }
};

export const verifyOtpCode = async (req, res) => {
  try {
    const { purpose, code, ticketId, otpId } = req.body;
    const cleanPurpose = normalizeOtpPurpose(purpose);
    if (!ALLOWED_PURPOSES.has(cleanPurpose) || cleanPurpose === 'forgot_password') {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose.' });
    }

    let phone = getUserOtpPhone(req);
    if (TICKET_PHONE_PURPOSES.has(cleanPurpose)) {
      const ticketData = await getTicketPhone(ticketId);
      if (!ticketData?.ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
      phone = ticketData.phone;
    }

    const data = await verifyOtp({
      purpose: cleanPurpose,
      phone,
      code,
      otpId,
      userId: req.user?.id,
      ticketId: TICKET_PHONE_PURPOSES.has(cleanPurpose) ? ticketId : null
    });

    await logActivity({
      req,
      action: 'OTP Verification',
      details: `Verified OTP for ${cleanPurpose}${ticketId ? ` ticket ${ticketId}` : ''}`
    });

    return res.json({ success: true, message: 'OTP verified.', data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      attemptsRemaining: error.attemptsRemaining,
      newOtpSent: error.newOtpSent
    });
  }
};

export const requestForgotPasswordOtp = async (req, res) => {
  try {
    const user = await resolveForgotPasswordUser({
      identifier: req.body.identifier || req.body.username,
      phone: req.body.phone
    });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    if (!user.phone) return res.status(400).json({ success: false, message: 'This account has no phone number.' });
    const phone = normalizeOtpPhone(user.phone);

    const data = await requestOtp({
      purpose: 'forgot_password',
      phone,
      userId: user.id,
      forceNew: req.body.resend === true
    });

    return res.json({ success: true, message: 'OTP sent.', data: { ...data, userId: user.id } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      retryAfter: error.retryAfter
    });
  }
};

export const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const user = await resolveForgotPasswordUser({
      identifier: req.body.identifier || req.body.username,
      phone: req.body.phone,
      userId: req.body.userId
    });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    if (!user.phone) return res.status(400).json({ success: false, message: 'This account has no phone number.' });
    const phone = normalizeOtpPhone(user.phone);

    const data = await verifyOtp({
      purpose: 'forgot_password',
      phone,
      code: req.body.code,
      otpId: req.body.otpId,
      userId: user.id
    });

    await logActivity({
      req,
      user: user.id,
      role: user.role || 'user',
      action: 'OTP Verification',
      details: 'Verified OTP for forgot_password'
    });

    return res.json({ success: true, message: 'OTP verified.', data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      attemptsRemaining: error.attemptsRemaining,
      newOtpSent: error.newOtpSent
    });
  }
};

export const resetForgotPassword = async (req, res) => {
  try {
    const { phone, password, verificationToken, userId } = req.body;
    const user = await resolveForgotPasswordUser({ userId, phone });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    const cleanPhone = normalizeOtpPhone(user.phone || phone);
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (!verifyOtpToken({
      token: verificationToken,
      purpose: 'forgot_password',
      userId: user.id,
      phone: cleanPhone
    })) {
      return res.status(401).json({ success: false, message: 'OTP verification required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, mustChangePassword: false, updatedAt: new Date() }
    });

    await logActivity({
      req,
      user: user.id,
      role: user.role || 'user',
      action: 'Password Reset',
      details: 'Password reset after OTP verification'
    });

    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
