import prisma from '../config/prisma.js';
import { generateRef } from '../utils/generateReference.js';
import { getCenterDistrict, isBanaadirNationalIdCenter, isNationalIdService, normalizeBanaadirDistrict } from '../utils/nqsScope.js';
import { canAccessTicket, getAssignedCenterId, isAdminRole, normalizeRole } from '../utils/rbac.js';
import {
  sendAppointmentCompletionEmail,
  sendQueueTicketGeneratedEmail
} from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';
import { normalizeOtpPhone, verifyOtpToken } from '../services/otpService.js';
import { issueNationalIdForCompletedRegistration } from '../utils/nationalIdIssuer.js';

const STAFF_QUEUE_ROLES = ['operator', 'super_operator', 'center_manager'];

const hydrateTickets = async (tickets = []) => {
  const serviceIds = [...new Set(tickets.map((ticket) => ticket.service).filter(Boolean))];
  const centerIds = [...new Set(tickets.map((ticket) => ticket.center).filter(Boolean))];
  const citizenIds = [...new Set(tickets.map((ticket) => ticket.citizen).filter(Boolean))];
  const [services, centers, citizens] = await Promise.all([
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, category: true, duration: true } })
      : [],
    centerIds.length
      ? prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, address: true, city: true, district: true, phone: true } })
      : [],
    citizenIds.length
      ? prisma.user.findMany({ where: { id: { in: citizenIds } }, select: { id: true, name: true, phone: true, nationalId: true, citizenProfile: { select: { nationalId: true } } } })
      : []
  ]);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const centersById = new Map(centers.map((center) => [center.id, center]));
  const citizensById = new Map(citizens.map((citizen) => [citizen.id, {
    ...citizen,
    nationalId: citizen.citizenProfile?.nationalId || citizen.nationalId
  }]));
  return tickets.map((ticket) => ({
    ...ticket,
    service: servicesById.get(ticket.service) || ticket.service,
    center: centersById.get(ticket.center) || ticket.center,
    citizen: citizensById.get(ticket.citizen) || ticket.citizen,
    nationalIdNumber: ticket.nationalIdNumber || citizensById.get(ticket.citizen)?.nationalId || ''
  }));
};

const logSmsForCitizen = async (citizenId, message) => {
  if (!citizenId) return;
  const citizen = await prisma.user.findUnique({
    where: { id: citizenId },
    select: { email: true, phone: true }
  });
  await logSmsOnly({ recipient: citizen?.phone, message });
};

// @desc    Generate walk-in ticket (typically by receptionist or kiosk)
// @route   POST /api/queue/generate
// @access  Private/Operator or Admin
export const generateWalkInTicket = async (req, res) => {
  try {
    const { serviceId, centerId, citizenName, citizenEmail, citizenPhone, timeSlot } = req.body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const center = await prisma.center.findUnique({ where: { id: centerId } });

    if (!service || !center) {
      return res.status(404).json({ success: false, message: 'Service or Center not found' });
    }

    if (!isNationalIdService(service) || !isBanaadirNationalIdCenter(center)) {
      return res.status(400).json({
        success: false,
        message: 'Queue tickets are limited to National ID services at approved Banaadir centers'
      });
    }

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(req.user.role)) && getAssignedCenterId(req.user) !== centerId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access another center’s data.' });
    }

    const refCode = await generateRef();
    const activeWaiting = await prisma.ticket.count({
      where: {
        center: centerId,
        status: 'Waiting',
        date: new Date().toISOString().slice(0, 10)
      }
    });
    const waitMins = activeWaiting * service.duration;

    const ticket = await prisma.ticket.create({
      data: {
        ref: refCode,
        service: serviceId,
        citizenName: citizenName || 'Walk-in Citizen',
        center: centerId,
        district: getCenterDistrict(center),
        date: new Date().toISOString().slice(0, 10),
        timeSlot: timeSlot || null,
        waitTime: waitMins > 0 ? `${waitMins} min` : '10 min',
        status: 'Waiting'
      }
    });

    await Promise.all([
      sendQueueTicketGeneratedEmail({
        to: citizenEmail,
        citizenName: ticket.citizenName,
        ticket,
        service,
        center
      }),
      logSmsOnly({
        recipient: citizenPhone,
        message: `Your National ID queue ticket is ${ticket.ref}. Center: ${center.name}.`
      })
    ]);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Generate Ticket',
        details: `Generated walk-in ticket ${refCode} at center ${center.name}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    // Socket.io Real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
    }

    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Call next ticket in queue
// @route   POST /api/queue/call-next
// @access  Private/Operator or Admin
export const callNextTicket = async (req, res) => {
  try {
    let { centerId, counter } = req.body;
    const userCenterId = getAssignedCenterId(req.user);

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(req.user.role)) && !centerId) {
      centerId = userCenterId;
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(req.user.role)) && getAssignedCenterId(req.user) !== centerId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access another center’s data.' });
    }

    // Find next ticket that is 'Waiting' for today at this center
    const nextTicket = await prisma.ticket.findFirst({
      where: {
        center: centerId,
        status: 'Waiting',
        date: new Date().toISOString().slice(0, 10)
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!nextTicket) {
      return res.status(400).json({ success: false, message: 'No waiting tickets in the queue' });
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: nextTicket.id },
      data: {
        status: 'Being Served',
        counter: counter || 'Counter 1'
      }
    });

    // Create Notification if ticket is linked to registered user
    let notif = null;
    if (updatedTicket.citizen) {
      notif = await prisma.notification.create({
        data: {
          user: updatedTicket.citizen,
          title: 'Queue Alert',
          desc: `Your ticket ${updatedTicket.ref} is being called to ${updatedTicket.counter}.`,
          category: 'Queue'
        }
      });
      await logSmsForCitizen(
        updatedTicket.citizen,
        `Your ticket ${updatedTicket.ref} is being called to ${updatedTicket.counter}.`
      );
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Call Next Ticket',
        details: `Operator called ticket ${updatedTicket.ref} to ${updatedTicket.counter}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    // Socket.io updates
    const io = req.app.get('io');
    if (io) {
      // Notify center room
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      // Notify TV display screen room with voice call data
      io.to(centerId.toString()).emit('voiceCallNext', {
        ref: updatedTicket.ref,
        counter: updatedTicket.counter,
        service: updatedTicket.service
      });
      // Notify individual ticket tracker
      io.to(updatedTicket.ref).emit('ticketUpdate', updatedTicket);
      // User individual feed
      if (updatedTicket.citizen && notif) {
        io.emit(`notification-${updatedTicket.citizen}`, notif);
      }
    }

    return res.json({ success: true, data: updatedTicket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Put current serving ticket on hold
// @route   PUT /api/queue/:id/hold
// @access  Private/Operator or Admin
export const holdTicket = async (req, res) => {
  try {
    let ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access another center’s data.' });
    }

    ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status: 'On Hold' }
    });

    let notif = null;
    if (ticket.citizen) {
      notif = await prisma.notification.create({
        data: {
          user: ticket.citizen,
          title: 'Queue Update',
          desc: `Your ticket ${ticket.ref} has been placed on hold. Please wait for the next update.`,
          category: 'Queue'
        }
      });
      await logSmsForCitizen(
        ticket.citizen,
        `Your ticket ${ticket.ref} has been placed on hold. Please wait for the next update.`
      );
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Hold Ticket',
        details: `Operator put ticket ${ticket.ref} on hold`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    // Socket.io Updates
    const io = req.app.get('io');
    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (ticket.citizen && notif) {
        io.emit(`notification-${ticket.citizen}`, notif);
      }
    }

    return res.json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete current ticket
// @route   PUT /api/queue/:id/complete
// @access  Private/Operator or Admin
export const completeTicket = async (req, res) => {
  try {
    let ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access another center’s data.' });
    }

    const citizenUserForOtp = ticket.citizen
      ? await prisma.user.findUnique({ where: { id: ticket.citizen }, select: { phone: true } })
      : null;
    const citizenPhone = normalizeOtpPhone(
      ticket.registrationDetails?.phone ||
      ticket.updateDetails?.phone ||
      ticket.replacementDetails?.phone ||
      citizenUserForOtp?.phone
    );
    if (!verifyOtpToken({
      token: req.body.otpToken,
      purpose: 'complete_service',
      userId: req.user.id,
      ticketId: ticket.id,
      phone: citizenPhone
    })) {
      return res.status(401).json({ success: false, message: 'OTP verification required before completing this service.' });
    }

    const dataToUpdate = {
      status: 'Completed'
    };
    if (ticket.requestType !== 'new_national_id') {
      dataToUpdate.requestStatus = 'Completed';
    }

    ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });
    if (ticket.requestType === 'new_national_id') {
      const nationalIdNumber = await issueNationalIdForCompletedRegistration(ticket);
      ticket = await prisma.ticket.update({
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

    // Create Notification
    let notif = null;
    if (ticket.citizen) {
      notif = await prisma.notification.create({
        data: {
          user: ticket.citizen,
          title: 'Service Completed',
          desc: `Thank you for visiting. Your service session for ${ticket.ref} has been completed.`,
          category: 'Queue'
        }
      });
      const [citizenUser, service, center] = await Promise.all([
        prisma.user.findUnique({ where: { id: ticket.citizen }, select: { name: true, email: true, phone: true } }),
        prisma.service.findUnique({ where: { id: ticket.service }, select: { name: true, category: true, duration: true } }),
        prisma.center.findUnique({ where: { id: ticket.center }, select: { name: true, address: true, city: true, district: true, phone: true } })
      ]);
      await Promise.all([
        sendAppointmentCompletionEmail({
          user: citizenUser,
          ticket,
          service,
          center
        }),
        logSmsOnly({
          recipient: citizenUser?.phone,
          message: `Thank you for visiting. Your service session for ticket ${ticket.ref} has been completed.`
        })
      ]);
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Complete Service',
        details: `Operator completed session for ticket ${ticket.ref}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    // Socket.io Updates
    const io = req.app.get('io');
    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (ticket.citizen && notif) {
        io.emit(`notification-${ticket.citizen}`, notif);
      }
    }

    return res.json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get live queue for specific center
// @route   GET /api/queue/live/:centerId
// @access  Public
export const getLiveQueue = async (req, res) => {
  try {
    const { centerId } = req.params;

    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: {
        center: centerId,
        status: { in: ['Waiting', 'Being Served', 'On Hold'] },
        date: new Date().toISOString().slice(0, 10)
      },
      orderBy: { createdAt: 'asc' }
    }));

    return res.json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track queue position for a ticket reference code
// @route   GET /api/queue/track/:ref
// @access  Public
export const trackTicket = async (req, res) => {
  try {
    const { ref } = req.params;

    const [ticket] = await hydrateTickets(await prisma.ticket.findMany({ where: { ref } }));

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket reference code not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to track this ticket.' });
    }

    const nowServing = await prisma.ticket.findFirst({
      where: {
        center: ticket.center.id,
        status: 'Being Served',
        date: ticket.date
      },
      orderBy: { updatedAt: 'desc' }
    });

    const nowServingPayload = nowServing
      ? {
          reference: nowServing.ref,
          counter: nowServing.counter || '--'
        }
      : null;

    if (ticket.status !== 'Waiting') {
      return res.json({
        success: true,
        data: {
          reference: ticket.ref,
          status: ticket.status,
          position: 0,
          peopleAhead: 0,
          estimatedWait: '0 min',
          center: ticket.center.name,
          service: ticket.service.name,
          requestType: ticket.requestType || 'new_national_id',
          requestStatus: ticket.requestStatus || 'Pending',
          appointmentDate: ticket.date,
          timeSlot: ticket.timeSlot,
          counter: ticket.counter || '--',
          nowServing: nowServingPayload
        }
      });
    }

    // Count how many tickets are Waiting before this one at the same center
    const aheadCount = await prisma.ticket.count({
      where: {
        center: ticket.center.id,
        status: 'Waiting',
        date: ticket.date,
        createdAt: { lt: ticket.createdAt }
      }
    });

    const position = aheadCount + 1;
    const estWaitMins = position * ticket.service.duration;

    return res.json({
      success: true,
      data: {
        reference: ticket.ref,
        status: ticket.status,
        position,
        peopleAhead: aheadCount,
        estimatedWait: `${estWaitMins} min`,
        center: ticket.center.name,
        service: ticket.service.name,
        requestType: ticket.requestType || 'new_national_id',
        requestStatus: ticket.requestStatus || 'Pending',
        appointmentDate: ticket.date,
        timeSlot: ticket.timeSlot,
        counter: ticket.counter || '--',
        nowServing: nowServingPayload
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tickets in the system (Admin overview)
// @route   GET /api/queue
// @access  Private/Operator or Admin
export const listTickets = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const { center = '', centerId = '', district = '' } = req.query;
    const requestedCenter = center || centerId;
    let query = {};
    if (role === 'citizen') {
      query = { citizen: req.user.id };
    }
    if (STAFF_QUEUE_ROLES.includes(role)) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!assignedCenterId) {
        return res.status(403).json({ success: false, message: 'Operator account is not assigned to a center.' });
      }
      if (requestedCenter && requestedCenter !== assignedCenterId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access another center’s data.' });
      }
      query = { center: assignedCenterId };
    } else if (isAdminRole(role)) {
      if (requestedCenter) {
        query.center = requestedCenter;
      }
      const normalizedDistrict = normalizeBanaadirDistrict(district);
      if (normalizedDistrict && !requestedCenter) {
        const centers = await prisma.center.findMany({
          where: { district: normalizedDistrict },
          select: { id: true }
        });
        query.center = { in: centers.map((item) => item.id) };
      }
    }
    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: query,
      orderBy: { createdAt: 'desc' }
    }));
    return res.json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
