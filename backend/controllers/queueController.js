import Ticket from '../models/Ticket.js';
import Center from '../models/Center.js';
import Service from '../models/Service.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { generateRef } from '../utils/generateReference.js';
import { isBanaadirNationalIdCenter, isNationalIdService } from '../utils/nqsScope.js';
import { canAccessTicket, getAssignedCenterId, normalizeRole } from '../utils/rbac.js';
import {
  sendAppointmentCompletionEmail,
  sendQueueTicketGeneratedEmail
} from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';

const logSmsForCitizen = async (citizenId, message) => {
  if (!citizenId) return;
  const citizen = await User.findById(citizenId).select('email phone');
  await logSmsOnly({ recipient: citizen?.phone, message });
};

// @desc    Generate walk-in ticket (typically by receptionist or kiosk)
// @route   POST /api/queue/generate
// @access  Private/Operator or Admin
export const generateWalkInTicket = async (req, res) => {
  try {
    const { serviceId, centerId, citizenName, citizenEmail, citizenPhone, timeSlot } = req.body;

    const service = await Service.findById(serviceId);
    const center = await Center.findById(centerId);

    if (!service || !center) {
      return res.status(404).json({ success: false, message: 'Service or Center not found' });
    }

    if (!isNationalIdService(service) || !isBanaadirNationalIdCenter(center)) {
      return res.status(400).json({
        success: false,
        message: 'Queue tickets are limited to National ID services at approved Banaadir centers'
      });
    }

    if (normalizeRole(req.user.role) === 'operator' && getAssignedCenterId(req.user) !== centerId.toString()) {
      return res.status(403).json({ success: false, message: 'Operators can only generate tickets for their assigned center.' });
    }

    const refCode = await generateRef();
    const activeWaiting = await Ticket.countDocuments({
      center: centerId,
      status: 'Waiting',
      date: new Date().toISOString().slice(0, 10)
    });
    const waitMins = activeWaiting * service.duration;

    const ticket = await Ticket.create({
      ref: refCode,
      service: serviceId,
      citizenName: citizenName || 'Walk-in Citizen',
      center: centerId,
      date: new Date().toISOString().slice(0, 10),
      timeSlot: timeSlot || null,
      waitTime: waitMins > 0 ? `${waitMins} min` : '10 min',
      status: 'Waiting'
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
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Generate Ticket',
      details: `Generated walk-in ticket ${refCode} at center ${center.name}`,
      ipAddress: req.ip || '127.0.0.1'
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

    if (normalizeRole(req.user.role) === 'operator' && !centerId) {
      centerId = userCenterId;
    }

    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    if (normalizeRole(req.user.role) === 'operator' && getAssignedCenterId(req.user) !== centerId.toString()) {
      return res.status(403).json({ success: false, message: 'Operators can only call tickets for their assigned center.' });
    }

    // Find next ticket that is 'Waiting' for today at this center
    const nextTicket = await Ticket.findOne({
      center: centerId,
      status: 'Waiting',
      date: new Date().toISOString().slice(0, 10)
    }).sort({ createdAt: 1 });

    if (!nextTicket) {
      return res.status(400).json({ success: false, message: 'No waiting tickets in the queue' });
    }

    // Update ticket
    nextTicket.status = 'Being Served';
    nextTicket.counter = counter || 'Counter 1';
    nextTicket.calledAt = new Date();
    await nextTicket.save();

    // Create Notification if ticket is linked to registered user
    let notif = null;
    if (nextTicket.citizen) {
      notif = await Notification.create({
        user: nextTicket.citizen,
        title: 'Queue Alert',
        desc: `Your ticket ${nextTicket.ref} is being called to ${nextTicket.counter}.`,
        category: 'Queue'
      });
      await logSmsForCitizen(
        nextTicket.citizen,
        `Your ticket ${nextTicket.ref} is being called to ${nextTicket.counter}.`
      );
    }

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Call Next Ticket',
      details: `Operator called ticket ${nextTicket.ref} to ${nextTicket.counter}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    // Socket.io updates
    const io = req.app.get('io');
    if (io) {
      // Notify center room
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      // Notify TV display screen room with voice call data
      io.to(centerId.toString()).emit('voiceCallNext', {
        ref: nextTicket.ref,
        counter: nextTicket.counter,
        service: nextTicket.service
      });
      // Notify individual ticket tracker
      io.to(nextTicket.ref).emit('ticketUpdate', nextTicket);
      // User individual feed
      if (nextTicket.citizen && notif) {
        io.emit(`notification-${nextTicket.citizen}`, notif);
      }
    }

    return res.json({ success: true, data: nextTicket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Put current serving ticket on hold
// @route   PUT /api/queue/:id/hold
// @access  Private/Operator or Admin
export const holdTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this ticket.' });
    }

    ticket.status = 'On Hold';
    await ticket.save();

    let notif = null;
    if (ticket.citizen) {
      notif = await Notification.create({
        user: ticket.citizen,
        title: 'Queue Update',
        desc: `Your ticket ${ticket.ref} has been placed on hold. Please wait for the next update.`,
        category: 'Queue'
      });
      await logSmsForCitizen(
        ticket.citizen,
        `Your ticket ${ticket.ref} has been placed on hold. Please wait for the next update.`
      );
    }

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Hold Ticket',
      details: `Operator put ticket ${ticket.ref} on hold`,
      ipAddress: req.ip || '127.0.0.1'
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
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to complete this ticket.' });
    }

    ticket.status = 'Completed';
    if (ticket.requestType !== 'new_national_id') {
      ticket.requestStatus = 'Completed';
    }
    ticket.completedAt = new Date();
    await ticket.save();

    // Create Notification
    let notif = null;
    if (ticket.citizen) {
      notif = await Notification.create({
        user: ticket.citizen,
        title: 'Service Completed',
        desc: `Thank you for visiting. Your service session for ${ticket.ref} has been completed.`,
        category: 'Queue'
      });
      const [citizenUser, service, center] = await Promise.all([
        User.findById(ticket.citizen).select('name email phone'),
        Service.findById(ticket.service).select('name category duration'),
        Center.findById(ticket.center).select('name address city phone')
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
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Complete Ticket',
      details: `Operator completed session for ticket ${ticket.ref}`,
      ipAddress: req.ip || '127.0.0.1'
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

    const tickets = await Ticket.find({
      center: centerId,
      status: { $in: ['Waiting', 'Being Served', 'On Hold'] },
      date: new Date().toISOString().slice(0, 10)
    })
      .populate('service')
      .sort({ createdAt: 1 });

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

    const ticket = await Ticket.findOne({ ref }).populate('service').populate('center');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket reference code not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to track this ticket.' });
    }

    const nowServing = await Ticket.findOne({
      center: ticket.center._id,
      status: 'Being Served',
      date: ticket.date
    }).sort({ calledAt: -1, updatedAt: -1 });

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
    const aheadCount = await Ticket.countDocuments({
      center: ticket.center._id,
      status: 'Waiting',
      date: ticket.date,
      createdAt: { $lt: ticket.createdAt }
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
    let query = {};
    if (role === 'citizen') {
      query = { citizen: req.user._id };
    }
    if (role === 'operator') {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!assignedCenterId) {
        return res.status(403).json({ success: false, message: 'Operator account is not assigned to a center.' });
      }
      query = { center: assignedCenterId };
    }
    const tickets = await Ticket.find(query).populate('service center').sort({ createdAt: -1 });
    return res.json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
