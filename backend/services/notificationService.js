import prisma from '../config/prisma.js';
import { sendNationalIdEmail } from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';
import { isAdminRole, normalizeRole } from '../utils/rbac.js';

const adminRequestTitle = (requestType = '') => {
  if (requestType === 'update_information') return 'New Update Information Request';
  if (requestType === 'lost_replacement') return 'New Lost ID Replacement Request';
  return 'New Appointment Booked';
};

const adminRequestLabel = (requestType = '') => {
  if (requestType === 'update_information') return 'National ID information update';
  if (requestType === 'lost_replacement') return 'lost National ID replacement';
  return 'new National ID appointment';
};

const STAFF_ROLES = ['operator', 'super_operator', 'center_manager'];
const OPERATOR_APPROVAL_ROLES = ['operator', 'super_operator', 'center_manager'];
const OPERATOR_APPROVAL_TYPE = 'OPERATOR_APPROVAL_REQUIRED';

const backfillRequestNotifications = async (user) => {
  const role = normalizeRole(user.role);
  const isAdmin = isAdminRole(role);
  const isCenterStaff = STAFF_ROLES.includes(role);

  if (!isAdmin && !isCenterStaff) return;

  const ticketWhere = {
    OR: [
      { requestStatus: 'Pending' },
      { status: { in: ['Pending', 'Waiting', 'On Hold'] } }
    ]
  };

  if (isCenterStaff) {
    if (!user.center) return;
    ticketWhere.center = user.center;
  }

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      ref: true,
      requestType: true,
      status: true,
      citizenName: true,
      center: true,
      createdAt: true
    }
  });
  if (!tickets.length) return;

  const ticketIds = tickets.map((ticket) => ticket.id);
  const existing = await prisma.notification.findMany({
    where: {
      user: user.id,
      notificationType: isAdmin ? 'ADMIN_NEW_REQUEST' : 'CENTER_NEW_REQUEST',
      relatedEntity: { in: ticketIds }
    },
    select: { relatedEntity: true }
  });
  const existingIds = new Set(existing.map((item) => item.relatedEntity));
  const missingTickets = tickets.filter((ticket) => !existingIds.has(ticket.id));
  if (!missingTickets.length) return;

  const centerIds = [...new Set(missingTickets.map((ticket) => ticket.center).filter(Boolean))];
  const centers = centerIds.length
    ? await prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true } })
    : [];
  const centersById = new Map(centers.map((center) => [center.id, center]));

  await prisma.notification.createMany({
    data: missingTickets.map((ticket) => {
      const centerName = centersById.get(ticket.center)?.name || 'selected center';
      const requestLabel = adminRequestLabel(ticket.requestType);
      return {
        user: user.id,
        title: adminRequestTitle(ticket.requestType),
        desc: `${ticket.citizenName || 'Citizen'} submitted ${requestLabel} ${ticket.ref} at ${centerName}.`,
        category: 'Appointments',
        notificationType: isAdmin ? 'ADMIN_NEW_REQUEST' : 'CENTER_NEW_REQUEST',
        referenceNumber: ticket.ref,
        requestType: ticket.requestType,
        relatedEntity: ticket.id,
        relatedEntityType: 'Ticket',
        newStatus: ticket.status || 'Pending',
        timestamp: ticket.createdAt
      };
    }),
    skipDuplicates: true
  });
};

const backfillOperatorApprovalNotifications = async (user) => {
  const role = normalizeRole(user.role);
  if (!isAdminRole(role)) return;

  const pendingOperators = await prisma.user.findMany({
    where: {
      role: { in: OPERATOR_APPROVAL_ROLES },
      status: 'pending_approval'
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      operatorType: true,
      center: true,
      assignedDistrict: true,
      createdAt: true
    }
  });
  const operatorIds = pendingOperators.map((operator) => operator.id);
  const staleApprovalWhere = {
    user: user.id,
    notificationType: OPERATOR_APPROVAL_TYPE,
    relatedEntityType: 'User'
  };
  if (operatorIds.length) {
    staleApprovalWhere.relatedEntity = { notIn: operatorIds };
  }
  await prisma.notification.deleteMany({ where: staleApprovalWhere });

  if (!pendingOperators.length) return;

  const existing = await prisma.notification.findMany({
    where: {
      user: user.id,
      notificationType: OPERATOR_APPROVAL_TYPE,
      relatedEntity: { in: operatorIds }
    },
    select: { relatedEntity: true }
  });
  const existingIds = new Set(existing.map((item) => item.relatedEntity));
  const missingOperators = pendingOperators.filter((operator) => !existingIds.has(operator.id));
  if (!missingOperators.length) return;

  const centerIds = [...new Set(missingOperators.map((operator) => operator.center).filter(Boolean))];
  const centers = centerIds.length
    ? await prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true } })
    : [];
  const centersById = new Map(centers.map((center) => [center.id, center]));

  await prisma.notification.createMany({
    data: missingOperators.map((operator) => {
      const centerName = centersById.get(operator.center)?.name || operator.assignedDistrict || 'assigned center';
      const operatorLabel = operator.operatorType === 'center_manager' || operator.role === 'center_manager'
        ? 'center manager'
        : 'operator';
      return {
        user: user.id,
        title: 'Operator Approval Required',
        desc: `${operator.name || operator.username} is waiting for Super Admin approval as ${operatorLabel} at ${centerName}.`,
        category: 'Operator Approval',
        notificationType: OPERATOR_APPROVAL_TYPE,
        relatedEntity: operator.id,
        relatedEntityType: 'User',
        timestamp: operator.createdAt
      };
    }),
    skipDuplicates: true
  });
};

export class NotificationService {
  static async getUserNotifications({ user }) {
    await backfillRequestNotifications(user);
    await backfillOperatorApprovalNotifications(user);

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { user: user.id },
          { user: null } 
        ]
      },
      orderBy: { timestamp: 'desc' }
    });

    return notifications;
  }

  static async sendNotification({ body, io }) {
    const {
      title,
      desc,
      category = 'System',
      userId = null,
      centerId = null,
      target = 'all_users',
      sendEmail = true,
      sendSms = true
    } = body;

    if (!title || !desc) {
      throw { statusCode: 400, message: 'Title and message are required' };
    }

    let recipientWhere = { role: { in: ['citizen', 'user'] } };
    if (userId) {
      recipientWhere = { id: userId };
    } else if (target === 'center') {
      if (!centerId) {
        throw { statusCode: 400, message: 'Center is required for center notifications.' };
      }
      recipientWhere = { center: centerId };
    } else if (target === 'operators') {
      recipientWhere = { role: { in: ['operator', 'super_operator', 'center_manager'] } };
    }

    const recipients = await prisma.user.findMany({ where: recipientWhere });
    const notifications = recipients.length
      ? await Promise.all(recipients.map((user) => prisma.notification.create({
          data: {
            user: user.id,
            title,
            desc,
            category
          }
        })))
      : [];

    const notification = notifications[0] || await prisma.notification.create({
      data: { user: userId || null, title, desc, category }
    });

    if (sendEmail) {
      await Promise.all(recipients.map((user) => sendNationalIdEmail({
        to: user.email,
        subject: title,
        template: {
          heading: title,
          intro: desc,
          rows: [
            ['Citizen name', user.name],
            ['Category', category]
          ]
        }
      })));
    }

    if (sendSms) {
      await Promise.all(recipients.map((user) => logSmsOnly({
        recipient: user.phone,
        message: desc
      })));
    }

    if (io) {
      if (userId) {
        io.emit(`notification-${userId}`, notification);
      } else if (centerId) {
        io.to(centerId).emit('notification-center', notification);
      } else {
        io.emit('notification-broadcast', notification);
      }
    }

    return { notificationsCount: notifications.length || 1, notification };
  }

  static async markNotificationAsRead({ id, user }) {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      throw { statusCode: 404, message: 'Notification not found' };
    }

    if (notification.user && notification.user.toString() !== user.id.toString()) {
      throw { statusCode: 403, message: 'Not authorized to modify this notification' };
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    return updatedNotification;
  }

  static async markAllNotificationsAsRead({ user }) {
    await prisma.notification.updateMany({
      where: {
        read: false,
        OR: [
          { user: user.id },
          { user: null }
        ]
      },
      data: { read: true }
    });

    return { message: 'All notifications marked as read' };
  }

  static async dismissNotification({ id, user }) {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      throw { statusCode: 404, message: 'Notification not found' };
    }

    if (notification.user && notification.user.toString() !== user.id.toString()) {
      throw { statusCode: 403, message: 'Not authorized to delete this notification' };
    }

    await prisma.notification.delete({ where: { id } });

    return { message: 'Notification deleted.' };
  }
}
