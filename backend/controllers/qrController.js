import QRCode from 'qrcode';
import prisma from '../config/prisma.js';
import { canAccessTicket } from '../utils/rbac.js';
import { issueNationalIdForCompletedRegistration } from '../utils/nationalIdIssuer.js';

const TICKET_REF_PATTERN = /^(REQ|NQS)-\d+$/i;

const normalizeTicketRef = (value = '') => value.trim().toUpperCase();

const getQueueNumber = (ticketRef) => ticketRef?.split('-').pop() || '--';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const idFrom = (value) => {
  if (!value) return value;
  if (typeof value === 'object') return value.id || value._id || value;
  return value;
};

const populateTicket = async (ticketRef) => {
  const ticket = await prisma.ticket.findFirst({ where: { ref: ticketRef } });
  if (!ticket) return null;
  const [service, center, citizen] = await Promise.all([
    ticket.service ? prisma.service.findUnique({ where: { id: ticket.service }, select: { id: true, name: true, duration: true, category: true } }) : null,
    ticket.center ? prisma.center.findUnique({ where: { id: ticket.center }, select: { id: true, name: true, address: true, city: true, phone: true } }) : null,
    ticket.citizen ? prisma.user.findUnique({ where: { id: ticket.citizen }, select: { id: true, name: true, email: true, phone: true, nationalId: true, photo: true, citizenProfile: { select: { nationalId: true } } } }) : null
  ]);
  return {
    ...ticket,
    service: service || ticket.service,
    center: center || ticket.center,
    citizen: citizen ? { ...citizen, nationalId: citizen.citizenProfile?.nationalId || citizen.nationalId } : ticket.citizen
  };
};

const formatTicketPayload = (ticket, scanId = null, extra = {}) => ({
  scanId,
  ticketId: ticket.id,
  ticketNumber: ticket.ref,
  ticketRef: ticket.ref,
  citizenName: ticket.citizen?.name || ticket.citizenName || 'Citizen',
  fullName: ticket.citizen?.name || ticket.citizenName || 'Citizen',
  nationalId: ticket.citizen?.nationalId || '',
  citizenPhoto: ticket.citizen?.photo || '',
  email: ticket.citizen?.email || '',
  phone: ticket.citizen?.phone || '',
  service: ticket.service?.name || 'National ID Registration',
  center: ticket.center?.name || 'Banaadir National ID Center',
  centerAddress: ticket.center?.address || '',
  appointmentDate: ticket.date,
  timeSlot: ticket.timeSlot || '--',
  queueNumber: getQueueNumber(ticket.ref),
  requestType: ticket.requestType || 'new_national_id',
  requestStatus: ticket.requestStatus || 'Pending',
  replacementDetails: ticket.replacementDetails || {},
  updateDetails: ticket.updateDetails || {},
  status: ticket.status,
  ...extra
});

const getScanResult = (ticket) => {
  if (!ticket) {
    return {
      status: 'Invalid',
      message: 'This QR ticket was not found. Please check the ticket reference.'
    };
  }

  if (ticket.status === 'Cancelled') {
    return {
      status: 'Cancelled',
      message: 'This appointment has been cancelled and cannot be verified.'
    };
  }

  if (ticket.status === 'Completed') {
    return {
      status: 'Completed',
      message: 'This appointment has already been completed.'
    };
  }

  if (ticket.date && ticket.date < getTodayKey()) {
    return {
      status: 'Expired',
      message: 'This QR ticket has expired because the appointment date has passed.'
    };
  }

  return {
    status: 'Valid',
    message: 'Ticket verified successfully.'
  };
};

const writeScanAudit = async ({ req, ticketRef, status, action = 'Verify QR Ticket' }) => {
  const [scan] = await Promise.all([
    prisma.qRScan.create({
      data: {
        ticketRef,
        scannedBy: req.user.id,
        status,
        ipAddress: req.ip || '127.0.0.1'
      }
    }),
    prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action,
        details: `${action}: ${ticketRef}. Result: ${status}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    })
  ]);

  return scan;
};

const emitTicketUpdate = (req, ticket) => {
  const io = req.app.get('io');
  if (!io || !ticket) return;

  if (ticket.center) {
    const centerId = idFrom(ticket.center);
    io.to(centerId.toString()).emit('queueUpdate', { centerId });
  }

  io.to(ticket.ref).emit('ticketUpdate', ticket);
};

// @desc    Generate QR code image server-side
// @route   GET /api/qr/generate
// @access  Public
export const generateQR = async (req, res) => {
  try {
    const text = normalizeTicketRef(req.query.text || '');
    if (!text) {
      return res.status(400).json({ success: false, message: 'Ticket reference is required' });
    }

    if (!TICKET_REF_PATTERN.test(text)) {
      return res.status(400).json({
        success: false,
        message: 'QR codes can only be generated for valid request references'
      });
    }

    const dataUrl = await QRCode.toDataURL(text, {
      margin: 2,
      width: 250,
      color: {
        dark: '#0f172a',  // Slate 900
        light: '#ffffff'
      }
    });

    return res.json({ success: true, data: dataUrl });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify QR scan and register logs
// @route   POST /api/qr/verify
// @access  Private/Operator or Admin
export const verifyQR = async (req, res) => {
  try {
    const ticketRef = normalizeTicketRef(req.body.ticketRef || req.body.reference || req.body.code || '');
    if (!ticketRef) {
      return res.status(400).json({ success: false, message: 'Ticket reference code is required' });
    }

    if (!TICKET_REF_PATTERN.test(ticketRef)) {
      const scan = await writeScanAudit({ req, ticketRef, status: 'Invalid' });
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code. Only request references can be scanned.',
        data: { scanId: scan.id, ticketRef, status: 'Invalid' }
      });
    }

    const ticket = await populateTicket(ticketRef);
    if (ticket && !canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to verify tickets for this center.' });
    }
    const result = getScanResult(ticket);
    const scan = await writeScanAudit({ req, ticketRef, status: result.status });

    if (result.status === 'Valid') {
      return res.json({
        success: true,
        message: result.message,
        data: formatTicketPayload(ticket, scan.id)
      });
    }

    return res.status(400).json({
      success: false,
      message: result.message,
      data: {
        scanId: scan.id,
        ticketRef,
        status: result.status,
        ...(ticket ? formatTicketPayload(ticket, scan.id) : {})
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply an operator/admin QR verification action
// @route   POST /api/qr/action
// @access  Private/Operator or Admin
export const handleQRAction = async (req, res) => {
  try {
    const ticketRef = normalizeTicketRef(req.body.ticketRef || req.body.reference || '');
    const action = (req.body.action || '').trim().toLowerCase();
    const allowedActions = ['verify', 'arrive', 'complete', 'cancel', 'reject'];

    if (!ticketRef) {
      return res.status(400).json({ success: false, message: 'Ticket reference code is required' });
    }

    if (!TICKET_REF_PATTERN.test(ticketRef)) {
      await writeScanAudit({ req, ticketRef, status: 'Rejected', action: 'Reject Invalid QR Ticket' });
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code. Only request references can be processed.'
      });
    }

    if (!allowedActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid QR action' });
    }

    const ticket = await populateTicket(ticketRef);

    if (ticket && !canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update tickets for this center.' });
    }

    if (action === 'reject') {
      await writeScanAudit({ req, ticketRef, status: 'Rejected', action: 'Reject Invalid QR Ticket' });
      return res.json({
        success: true,
        message: 'Ticket has been rejected for review.',
        data: ticket ? formatTicketPayload(ticket, null, { actionStatus: 'Rejected' }) : { ticketRef, status: 'Rejected' }
      });
    }

    const result = getScanResult(ticket);
    if (result.status !== 'Valid') {
      const scan = await writeScanAudit({ req, ticketRef, status: result.status, action: 'QR Ticket Action Blocked' });
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          scanId: scan.id,
          ticketRef,
          status: result.status,
          ...(ticket ? formatTicketPayload(ticket, scan.id) : {})
        }
      });
    }

    let auditAction = 'QR Ticket Verified';
    let scanStatus = 'Verified';
    let message = 'Ticket verified successfully.';
    let actionStatus = 'Verified';
    
    let updateData = {};

    if (action === 'verify') {
      auditAction = 'QR Ticket Verified';
      scanStatus = 'Verified';
      message = 'Ticket verified successfully.';
      actionStatus = 'Verified';
    }

    if (action === 'arrive') {
      updateData.status = 'Being Served';
      if (!ticket.counter) updateData.counter = 'Verification Desk';
      auditAction = 'Mark Citizen Arrived';
      scanStatus = 'Arrived';
      message = 'Citizen marked as arrived.';
      actionStatus = 'Arrived';
    }

    if (action === 'complete') {
      updateData.status = 'Completed';
      if (ticket.requestType !== 'new_national_id') {
        updateData.requestStatus = 'Completed';
      }
      auditAction = 'Complete Appointment From QR';
      scanStatus = 'Completed';
      message = 'Appointment marked as completed.';
      actionStatus = 'Completed';
    }

    if (action === 'cancel') {
      updateData.status = 'Cancelled';
      if (ticket.requestType !== 'new_national_id') {
        updateData.requestStatus = 'Rejected';
      }
      auditAction = 'Cancel Appointment From QR';
      scanStatus = 'Cancelled';
      message = 'Appointment cancelled.';
      actionStatus = 'Cancelled';
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: updateData
    });
    if (action === 'complete' && ticket.requestType === 'new_national_id') {
      const nationalIdNumber = await issueNationalIdForCompletedRegistration(ticket);
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          nationalIdNumber,
          registrationDetails: {
            ...(ticket.registrationDetails || {}),
            nationalIdNumber
          },
          requestStatus: 'Completed'
        }
      });
    }
    
    const updatedTicket = await populateTicket(ticketRef);
    const scan = await writeScanAudit({ req, ticketRef, status: scanStatus, action: auditAction });

    if (updatedTicket.citizen?.id) {
      await prisma.notification.create({
        data: {
          user: updatedTicket.citizen.id,
          title: action === 'complete'
            ? 'Appointment Completed'
            : action === 'cancel'
              ? 'Appointment Cancelled'
              : action === 'arrive'
                ? 'Arrival Recorded'
                : 'Ticket Verified',
          desc: action === 'complete'
            ? `Your National ID appointment ${ticketRef} has been completed.`
            : action === 'cancel'
              ? `Your National ID appointment ${ticketRef} has been cancelled.`
              : action === 'arrive'
                ? `Your arrival for National ID ticket ${ticketRef} has been recorded.`
                : `Your National ID ticket ${ticketRef} has been verified at the center.`,
          category: 'Queue'
        }
      });
    }

    emitTicketUpdate(req, updatedTicket);

    return res.json({
      success: true,
      message,
      data: formatTicketPayload(updatedTicket, scan.id, { actionStatus })
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
