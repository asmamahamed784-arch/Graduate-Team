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

export class QueueService {
  static async generateWalkInTicket({ body, user, ipAddress, io }) {
    const { serviceId, centerId, citizenName, citizenEmail, citizenPhone, timeSlot } = body;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const center = await prisma.center.findUnique({ where: { id: centerId } });

    if (!service || !center) {
      throw { statusCode: 404, message: 'Service or Center not found' };
    }

    if (!isNationalIdService(service) || !isBanaadirNationalIdCenter(center)) {
      throw {
        statusCode: 400,
        message: 'Queue tickets are limited to National ID services at approved Banaadir centers'
      };
    }

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(user.role)) && getAssignedCenterId(user) !== centerId.toString()) {
      throw { statusCode: 403, message: 'You are not authorized to access another center’s data.' };
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

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Generate Ticket',
        details: `Generated walk-in ticket ${refCode} at center ${center.name}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
    }

    return ticket;
  }

  static async callNextTicket({ body, user, ipAddress, io }) {
    let { centerId, counter } = body;
    const userCenterId = getAssignedCenterId(user);

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(user.role)) && !centerId) {
      centerId = userCenterId;
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) {
      throw { statusCode: 404, message: 'Center not found' };
    }

    if (STAFF_QUEUE_ROLES.includes(normalizeRole(user.role)) && getAssignedCenterId(user) !== centerId.toString()) {
      throw { statusCode: 403, message: 'You are not authorized to access another center’s data.' };
    }

    const nextTicket = await prisma.ticket.findFirst({
      where: {
        center: centerId,
        status: 'Waiting'
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    if (!nextTicket) {
      throw { statusCode: 400, message: 'No waiting tickets in the queue' };
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: nextTicket.id },
      data: {
        status: 'Being Served',
        counter: counter || 'Counter 1'
      }
    });

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

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Call Next Ticket',
        details: `Operator called ticket ${updatedTicket.ref} to ${updatedTicket.counter}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      io.to(centerId.toString()).emit('voiceCallNext', {
        ref: updatedTicket.ref,
        counter: updatedTicket.counter,
        service: updatedTicket.service
      });
      io.to(updatedTicket.ref).emit('ticketUpdate', updatedTicket);
      if (updatedTicket.citizen && notif) {
        io.emit(`notification-${updatedTicket.citizen}`, notif);
      }
    }

    return updatedTicket;
  }

  static async holdTicket({ id, user, ipAddress, io }) {
    let ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to access another center’s data.' };
    }

    ticket = await prisma.ticket.update({
      where: { id },
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

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Hold Ticket',
        details: `Operator put ticket ${ticket.ref} on hold`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (ticket.citizen && notif) {
        io.emit(`notification-${ticket.citizen}`, notif);
      }
    }

    return ticket;
  }

  static async completeTicket({ id, body, user, ipAddress, io }) {
    let ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to access another center’s data.' };
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
      token: body.otpToken,
      purpose: 'complete_service',
      userId: user.id,
      ticketId: ticket.id,
      phone: citizenPhone
    })) {
      throw { statusCode: 401, message: 'OTP verification required before completing this service.' };
    }

    const dataToUpdate = {
      status: 'Completed',
      completedAt: ticket.completedAt || new Date()
    };
    if (ticket.requestType !== 'new_national_id') {
      dataToUpdate.requestStatus = 'Completed';
    }

    ticket = await prisma.ticket.update({
      where: { id },
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

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Complete Service',
        details: `Operator completed session for ticket ${ticket.ref}`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (ticket.citizen && notif) {
        io.emit(`notification-${ticket.citizen}`, notif);
      }
    }

    return ticket;
  }

  static async getLiveQueue(centerId) {
    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: {
        center: centerId,
        status: { in: ['Waiting', 'Being Served', 'On Hold'] },
        date: new Date().toISOString().slice(0, 10)
      },
      orderBy: { createdAt: 'asc' }
    }));
    return tickets;
  }

  static async trackTicket(ref, user) {
    const [ticket] = await hydrateTickets(await prisma.ticket.findMany({ where: { ref } }));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket reference code not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to track this ticket.' };
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
      return {
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
      };
    }

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

    return {
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
    };
  }

  static async listTickets({ query: reqQuery, user }) {
    const role = normalizeRole(user.role);
    const { center = '', centerId = '', district = '' } = reqQuery;
    const requestedCenter = center || centerId;
    let query = {};
    
    if (role === 'citizen') {
      query = { citizen: user.id };
    }
    if (STAFF_QUEUE_ROLES.includes(role)) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!assignedCenterId) {
        throw { statusCode: 403, message: 'Operator account is not assigned to a center.' };
      }
      if (requestedCenter && requestedCenter !== assignedCenterId) {
        throw { statusCode: 403, message: 'You are not authorized to access another center’s data.' };
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
    return tickets;
  }
}
