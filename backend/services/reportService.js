import prisma from '../config/prisma.js';
import { getAssignedCenterId, normalizeRole } from '../utils/rbac.js';
import { getMogadishuDayBounds, mogadishuDateKey } from '../utils/timezone.js';

const STAFF_CENTER_ROLES = ['operator', 'super_operator', 'center_manager'];
const CORRECTION_ACTIVE_STATUSES = new Set(['Pending', 'Approved', 'Scheduled', 'Waiting', 'Being Served', 'In Progress', 'On Hold']);
const OPERATOR_ONLINE_WINDOW_MS = 5 * 60 * 1000;

const dateKey = (date) => mogadishuDateKey(date);

const countOnlineOperators = async () => {
  const onlineSince = new Date(Date.now() - OPERATOR_ONLINE_WINDOW_MS);

  await prisma.activeSession.updateMany({
    where: {
      status: 'active',
      lastActiveTime: { lt: onlineSince }
    },
    data: {
      status: 'inactive',
      loggedOutAt: new Date()
    }
  });

  const liveSessions = await prisma.activeSession.findMany({
    where: {
      status: 'active',
      loggedOutAt: null,
      lastActiveTime: { gte: onlineSince },
      role: 'operator'
    },
    select: { user: true },
    distinct: ['user']
  });

  if (!liveSessions.length) return 0;

  const userIds = liveSessions.map((session) => session.user).filter(Boolean);
  if (!userIds.length) return 0;

  return prisma.user.count({
    where: {
      id: { in: userIds },
      role: 'operator',
      lastActiveAt: { gte: onlineSince }
    }
  });
};

const hydrateTickets = async (tickets = []) => {
  const serviceIds = [...new Set(tickets.map((ticket) => ticket.service).filter(Boolean))];
  const centerIds = [...new Set(tickets.map((ticket) => ticket.center).filter(Boolean))];
  const [services, centers] = await Promise.all([
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, category: true, duration: true } })
      : [],
    centerIds.length
      ? prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, district: true, city: true } })
      : []
  ]);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const centersById = new Map(centers.map((center) => [center.id, center]));
  return tickets.map((ticket) => ({
    ...ticket,
    service: servicesById.get(ticket.service) || ticket.service,
    center: centersById.get(ticket.center) || ticket.center
  }));
};

const cleanStringArray = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const getEmbeddedCancellationDetails = (ticket = {}) => (
  ticket.registrationDetails?.cancellationDetails ||
  ticket.replacementDetails?.cancellationDetails ||
  ticket.updateDetails?.cancellationDetails ||
  {}
);

const correctionResolvedFromTicket = (ticket = {}) => Boolean(
  ticket.registrationDetails?.correctionResolved ||
  ticket.replacementDetails?.correctionResolved ||
  ticket.updateDetails?.correctionResolved
);

const applyUnresolvedCorrectionState = (ticket = {}, hasFeedback = false) => {
  const correctionResolved = correctionResolvedFromTicket(ticket);
  const unresolvedCorrection = hasFeedback && !correctionResolved && CORRECTION_ACTIVE_STATUSES.has(ticket.status);
  return {
    status: unresolvedCorrection ? 'Cancelled' : ticket.status,
    requestStatus: unresolvedCorrection ? 'Resubmission Required' : ticket.requestStatus,
    needsResubmission: unresolvedCorrection || ticket.needsResubmission || false,
    hasCorrectionFeedback: hasFeedback,
    correctionResolved
  };
};

const cancellationDetailsFromTicket = (ticket = {}) => {
  const embedded = getEmbeddedCancellationDetails(ticket);
  return {
    cancellationReason: ticket.cancellationReason || embedded.cancellationReason || embedded.summary || '',
    cancellationReasons: cleanStringArray(ticket.cancellationReasons || embedded.cancellationReasons || embedded.reasons),
    additionalCancellationReason: ticket.additionalCancellationReason || embedded.additionalCancellationReason || embedded.additionalReason || '',
    cancellationNotes: ticket.cancellationNotes || embedded.cancellationNotes || embedded.additionalNotes || '',
    previousStatusBeforeCancellation: ticket.previousStatusBeforeCancellation || embedded.previousStatusBeforeCancellation || '',
    cancelledBy: ticket.cancelledBy || embedded.cancelledBy || '',
    cancelledAt: ticket.cancelledAt || embedded.cancelledAt || null
  };
};

const enrichTicketsWithCorrectionFeedback = async (tickets = []) => {
  const ticketIds = tickets.map((ticket) => ticket.id).filter(Boolean);
  if (!ticketIds.length) return tickets;

  const [feedbackRows, notificationRows] = await Promise.all([
    prisma.requestCorrectionFeedback.findMany({
      where: { request: { in: ticketIds } },
      orderBy: { id: 'asc' }
    }),
    prisma.notification.findMany({
      where: {
        OR: [
          { relatedEntity: { in: ticketIds } },
          { referenceNumber: { in: tickets.map((ticket) => ticket.ref).filter(Boolean) } }
        ]
      },
      orderBy: { timestamp: 'desc' }
    })
  ]);

  const reasonIds = [...new Set(feedbackRows.map((row) => row.correctionReason).filter(Boolean))];
  const reasonDocs = reasonIds.length
    ? await prisma.correctionReason.findMany({ where: { id: { in: reasonIds } } })
    : [];
  const reasonById = new Map(reasonDocs.map((reason) => [reason.id, reason.reasonName]));

  const feedbackByTicket = new Map();
  feedbackRows.forEach((row) => {
    const current = feedbackByTicket.get(row.request) || { reasons: [], notes: [] };
    const reasonName = reasonById.get(row.correctionReason) || row.correctionReason;
    if (reasonName && !current.reasons.includes(reasonName)) current.reasons.push(reasonName);
    if (row.additionalNote && !current.notes.includes(row.additionalNote)) current.notes.push(row.additionalNote);
    feedbackByTicket.set(row.request, current);
  });

  const notificationByTicket = new Map();
  notificationRows.forEach((notification) => {
    const key = notification.relatedEntity || tickets.find((ticket) => ticket.ref === notification.referenceNumber)?.id;
    if (!key || notificationByTicket.has(key)) return;
    const text = `${notification.title || ''} ${notification.desc || ''} ${notification.notificationType || ''}`.toLowerCase();
    if (!text.includes('cancel') && !text.includes('correction') && !text.includes('resubmit')) return;
    notificationByTicket.set(key, notification);
  });

  return tickets.map((ticket) => {
    const existing = cancellationDetailsFromTicket(ticket);
    if (existing.cancellationReason || existing.cancellationReasons.length || existing.cancellationNotes) {
      return {
        ...ticket,
        ...existing,
        ...applyUnresolvedCorrectionState(ticket, true)
      };
    }

    const feedback = feedbackByTicket.get(ticket.id);
    if (feedback) {
      return {
        ...ticket,
        ...applyUnresolvedCorrectionState(ticket, true),
        cancellationReason: feedback.reasons.join(', '),
        cancellationReasons: feedback.reasons,
        cancellationNotes: feedback.notes.join(' '),
        additionalCancellationReason: '',
        previousStatusBeforeCancellation: '',
        cancelledAt: null,
        cancelledBy: ''
      };
    }

    const notification = notificationByTicket.get(ticket.id);
    if (notification) {
      const reasons = cleanStringArray(notification.cancellationReasons);
      return {
        ...ticket,
        ...applyUnresolvedCorrectionState(ticket, true),
        cancellationReason: notification.cancellationReason || (reasons.length ? reasons.join(', ') : notification.desc || ''),
        cancellationReasons: reasons.length ? reasons : (notification.cancellationReason ? [notification.cancellationReason] : []),
        additionalCancellationReason: notification.additionalCancellationReason || '',
        cancellationNotes: notification.cancellationNotes || '',
        previousStatusBeforeCancellation: notification.previousStatus || '',
        cancelledAt: notification.cancellationDate || null,
        cancelledBy: ''
      };
    }

    return {
      ...ticket,
      ...existing,
      ...applyUnresolvedCorrectionState(ticket, false)
    };
  });
};

const formatTicketForDashboard = (ticket) => ({
  id: ticket.id,
  _id: ticket.id,
  ref: ticket.ref,
  service: ticket.service || null,
  serviceName: ticket.service?.name || 'Unknown Service',
  citizenName: ticket.citizenName || 'Unknown Citizen',
  center: ticket.center || null,
  centerName: ticket.center?.name || null,
  centerId: ticket.center?.id || ticket.center || null,
  requestType: ticket.requestType,
  status: ticket.status,
  requestStatus: ticket.requestStatus,
  needsResubmission: ticket.needsResubmission || false,
  hasCorrectionFeedback: ticket.hasCorrectionFeedback || false,
  correctionResolved: ticket.correctionResolved || false,
  waitTime: ticket.waitTime || '0 min',
  counter: ticket.counter || '--',
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  date: ticket.date,
  timeSlot: ticket.timeSlot,
  queueNumber: ticket.queueNumber,
  registrationDetails: ticket.registrationDetails,
  updateDetails: ticket.updateDetails,
  replacementDetails: ticket.replacementDetails,
  ...cancellationDetailsFromTicket(ticket)
});

const statusIn = (...statuses) => ({ in: statuses });

const centerCountWhere = (base = {}, extra = {}) => ({
  ...base,
  ...extra
});

const buildCenterDashboardCounts = async (baseWhere = {}, todayStr = '') => {
  const todayWhere = todayStr ? { ...baseWhere, date: todayStr } : baseWhere;
  const countFor = (where) => prisma.ticket.count({ where });

  const [
    totalAppointments,
    pending,
    waiting,
    nowServing,
    completed,
    cancelled,
    noShow,
    todayTotal,
    todayPending,
    todayWaiting,
    todayNowServing,
    todayCompleted,
    todayCancelled,
    todayNoShow
  ] = await Promise.all([
    countFor(baseWhere),
    countFor(centerCountWhere(baseWhere, { OR: [{ status: 'Pending' }, { requestStatus: 'Pending' }] })),
    countFor(centerCountWhere(baseWhere, { status: 'Waiting' })),
    countFor(centerCountWhere(baseWhere, { status: statusIn('Being Served', 'In Progress') })),
    countFor(centerCountWhere(baseWhere, { status: 'Completed' })),
    countFor(centerCountWhere(baseWhere, { status: statusIn('Cancelled', 'Canceled', 'Rejected') })),
    countFor(centerCountWhere(baseWhere, { status: statusIn('No Show', 'No-Show', 'NoShow') })),
    countFor(todayWhere),
    countFor(centerCountWhere(todayWhere, { OR: [{ status: 'Pending' }, { requestStatus: 'Pending' }] })),
    countFor(centerCountWhere(todayWhere, { status: 'Waiting' })),
    countFor(centerCountWhere(todayWhere, { status: statusIn('Being Served', 'In Progress') })),
    countFor(centerCountWhere(todayWhere, { status: 'Completed' })),
    countFor(centerCountWhere(todayWhere, { status: statusIn('Cancelled', 'Canceled', 'Rejected') })),
    countFor(centerCountWhere(todayWhere, { status: statusIn('No Show', 'No-Show', 'NoShow') }))
  ]);

  return {
    totalAppointments,
    pending,
    waiting,
    nowServing,
    completed,
    cancelled,
    noShow,
    today: {
      totalAppointments: todayTotal,
      pending: todayPending,
      waiting: todayWaiting,
      nowServing: todayNowServing,
      completed: todayCompleted,
      cancelled: todayCancelled,
      noShow: todayNoShow
    }
  };
};

export class ReportService {
  static async getDashboardStats() {
    const today = new Date();
    const { dayKey: todayStr, start: todayStart, end: todayEnd } = getMogadishuDayBounds(today);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalAppointments,
      waitingQueue,
      nowServing,
      onHoldQueue,
      totalCitizens,
      totalOperators,
      activeOperators,
      enabledOperators,
      pendingOperators,
      activeServices,
      serviceCenters,
      dailyVisitors,
      completedServices,
      cancelledAppointments,
      lostIdRequests,
      updateRequests,
      weeklyBookings,
      monthlyBookings,
      queueTimeAverages
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'Waiting', date: todayStr } }),
      prisma.ticket.count({ where: { status: { in: ['Being Served', 'In Progress'] }, date: todayStr } }),
      prisma.ticket.count({ where: { status: 'On Hold', date: todayStr } }),
      prisma.user.count({ where: { role: { in: ['citizen', 'user'] } } }),
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] } } }),
      countOnlineOperators(),
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] }, status: { in: ['active', 'Active'] } } }),
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] }, status: { in: ['pending_approval', 'Pending Approval'] } } }),
      prisma.service.count({ where: { status: 'Active' } }),
      prisma.center.count(),
      prisma.ticket.count({ where: { date: todayStr } }),
      prisma.ticket.count({
        where: {
          status: 'Completed',
          completedAt: {
            gte: todayStart,
            lt: todayEnd
          }
        }
      }),
      prisma.ticket.count({ where: { status: 'Cancelled' } }),
      prisma.ticket.count({ where: { requestType: 'lost_replacement' } }),
      prisma.ticket.count({ where: { requestType: 'update_information' } }),
      prisma.ticket.count({ where: { date: { gte: dateKey(weekStart) } } }),
      prisma.ticket.count({ where: { date: { gte: dateKey(monthStart) } } }),
      prisma.queueHistory.aggregate({
        _avg: {
          waitTime: true,
          serviceTime: true
        }
      })
    ]);
    const activeQueues = waitingQueue + nowServing + onHoldQueue;
    const completedToday = completedServices;

    const mostActiveCenterAgg = await prisma.ticket.groupBy({
      by: ['center'],
      _count: { center: true },
      orderBy: { _count: { center: 'desc' } },
      take: 1
    });
    const mostActiveCenterDoc = mostActiveCenterAgg[0]?.center
      ? await prisma.center.findUnique({ where: { id: mostActiveCenterAgg[0].center }, select: { name: true } })
      : null;

    const cancelledCount = await prisma.ticket.count({ where: { status: 'Cancelled', date: todayStr } });
    const totalTodayResolved = completedServices + cancelledCount;
    const efficiency = totalTodayResolved > 0 ? Math.round((completedServices / totalTodayResolved) * 100) : 0;

    const recentTickets = await hydrateTickets(await prisma.ticket.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5
    }));

    const recentActivities = recentTickets.map((t) => {
      let actionText = '';
      if (t.status === 'Waiting') actionText = `Ticket ${t.ref} booked for ${t.service.name}`;
      else if (t.status === 'Being Served') actionText = `Ticket ${t.ref} is being served at ${t.counter}`;
      else if (t.status === 'Completed') actionText = `Ticket ${t.ref} completed service session`;
      else if (t.status === 'Cancelled') actionText = `Ticket ${t.ref} cancelled booking`;
      else if (t.status === 'On Hold') actionText = `Ticket ${t.ref} placed on hold`;

      return {
        id: t.id,
        action: actionText,
        time: t.updatedAt,
        status: t.status,
        ref: t.ref
      };
    });

    return {
      totalAppointments,
      totalBookings: totalAppointments,
      activeQueues,
      waitingQueue,
      nowServing,
      totalCitizens,
      totalUsers: totalCitizens,
      totalOperators,
      activeOperators,
      enabledOperators,
      pendingOperators,
      activeServices,
      serviceCenters,
      totalServiceCenters: serviceCenters,
      dailyVisitors,
      dailyBookings: dailyVisitors,
      weeklyBookings,
      monthlyBookings,
      mostActiveCenter: {
        name: mostActiveCenterDoc?.name || 'Not available',
        count: mostActiveCenterAgg[0]?._count?.center || 0
      },
      completedToday,
      completedServices: completedToday,
      timezone: 'Africa/Mogadishu',
      onlineWindowMinutes: 5,
      cancelledAppointments,
      lostIdRequests,
      updateRequests,
      averageWaitingTime: Math.round(queueTimeAverages._avg.waitTime || 0),
      averageServiceTime: Math.round(queueTimeAverages._avg.serviceTime || 0),
      efficiency: `${efficiency}%`,
      queueEfficiency: `${efficiency}%`,
      systemUptime: 'Online',
      recentActivities
    };
  }

  static async getOperatorDashboardStats({ user, query: reqQuery }) {
    const today = new Date();
    const todayStr = dateKey(today);
    const userAssignedCenterId = getAssignedCenterId(user);
    const requestedCenterId = reqQuery.centerId || '';
    const role = normalizeRole(user.role);

    let assignedCenterId = requestedCenterId || userAssignedCenterId;
    if (STAFF_CENTER_ROLES.includes(role)) {
      if (!userAssignedCenterId) {
        throw { statusCode: 403, message: 'Operator account is not assigned to a center.' };
      }
      if (requestedCenterId && requestedCenterId !== userAssignedCenterId) {
        throw { statusCode: 403, message: 'You are not authorized to access another center data.' };
      }
      assignedCenterId = userAssignedCenterId;
    }

    const query = {};
    if (assignedCenterId) {
      query.center = assignedCenterId;
    }

    const tickets = await enrichTicketsWithCorrectionFeedback(await hydrateTickets(await prisma.ticket.findMany({
      where: query,
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 250
    })));
    const centerDashboardCounts = await buildCenterDashboardCounts(query, todayStr);

    const currentlyServing = tickets.find((ticket) => ticket.status === 'Being Served' || ticket.status === 'In Progress') || null;
    const waitingTickets = tickets.filter((ticket) => ticket.status === 'Waiting');
    const completedTickets = tickets.filter((ticket) => ticket.status === 'Completed');
    const cancelledTickets = tickets.filter((ticket) => ['Cancelled', 'Canceled', 'Rejected'].includes(ticket.status));
    const pendingTickets = tickets.filter((ticket) => ticket.status === 'Pending');
    const servedToday = completedTickets.filter((ticket) => ticket.date === todayStr);
    const adjustedCenterStats = {
      ...centerDashboardCounts,
      pending: pendingTickets.length,
      waiting: waitingTickets.length,
      completed: completedTickets.length,
      cancelled: cancelledTickets.length,
      totalAppointments: tickets.length,
      today: {
        ...centerDashboardCounts.today,
        waiting: waitingTickets.filter((ticket) => ticket.date === todayStr).length,
        completed: servedToday.length,
        cancelled: cancelledTickets.filter((ticket) => ticket.date === todayStr).length
      }
    };

    const serviceTimeAverage = assignedCenterId
      ? await prisma.queueHistory.aggregate({
          where: { center: assignedCenterId, date: todayStr },
          _avg: { serviceTime: true }
        })
      : { _avg: { serviceTime: null } };
    const avgServiceTime = serviceTimeAverage._avg.serviceTime
      ? `${Math.round(serviceTimeAverage._avg.serviceTime)} min`
      : '--';

    return {
      centerName: currentlyServing?.center?.name || tickets[0]?.center?.name || null,
      currentlyServing: currentlyServing ? formatTicketForDashboard(currentlyServing) : null,
      ticketsWaitingCount: waitingTickets.length,
      ticketsWaiting: waitingTickets.map(formatTicketForDashboard),
      servedTodayCount: servedToday.length,
      servedToday: servedToday.map(formatTicketForDashboard),
      completedCount: adjustedCenterStats.completed,
      cancelledCount: adjustedCenterStats.cancelled,
      totalAppointments: adjustedCenterStats.totalAppointments,
      completedTickets: completedTickets.map(formatTicketForDashboard),
      cancelledTickets: cancelledTickets.map(formatTicketForDashboard),
      avgServiceTime,
      centerStats: adjustedCenterStats,
      todayStats: adjustedCenterStats.today,
      allCenterTickets: tickets.map(formatTicketForDashboard)
    };
  }

  static async getOperatorQueue({ user }) {
    const todayStr = dateKey(new Date());
    const assignedCenterId = getAssignedCenterId(user);

    if (!assignedCenterId) {
      throw { statusCode: 403, message: 'Operator account is not assigned to a center.' };
    }

    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: {
        center: assignedCenterId,
        status: { in: ['Waiting', 'Being Served', 'On Hold', 'Pending'] }
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 250
    }));

    const currentlyServing = tickets.find((ticket) => ticket.status === 'Being Served') || null;
    const waitingTickets = tickets.filter((ticket) => ticket.status === 'Waiting' || ticket.status === 'Pending');
    const onHoldTickets = tickets.filter((ticket) => ticket.status === 'On Hold');
    const waitingToday = waitingTickets.filter((ticket) => ticket.date === todayStr);
    const waitingUpcoming = waitingTickets.filter((ticket) => ticket.date && ticket.date > todayStr);

    return {
      centerName: user?.center?.name || tickets[0]?.center?.name || null,
      currentlyServing: currentlyServing ? formatTicketForDashboard(currentlyServing) : null,
      waitingCount: waitingTickets.length,
      waitingTodayCount: waitingToday.length,
      waitingUpcomingCount: waitingUpcoming.length,
      waitingTickets: waitingTickets.map(formatTicketForDashboard),
      waitingToday: waitingToday.map(formatTicketForDashboard),
      waitingUpcoming: waitingUpcoming.map(formatTicketForDashboard),
      onHoldCount: onHoldTickets.length,
      onHoldTickets: onHoldTickets.map(formatTicketForDashboard),
      allActiveTickets: tickets.map(formatTicketForDashboard)
    };
  }

  static async getReportsAndAnalytics() {
    const today = new Date();
    const todayStr = dateKey(today);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const apptsByService = await prisma.ticket.groupBy({
      by: ['service'],
      _count: { service: true }
    });
    const appointmentsByServiceData = await Promise.all(apptsByService.map(async item => {
      let serviceName = 'Unknown Service';
      if (item.service) {
        const serviceDoc = await prisma.service.findUnique({ where: { id: item.service }, select: { name: true } });
        if (serviceDoc) serviceName = serviceDoc.name;
      }
      return {
        service: serviceName,
        count: item._count.service
      };
    }));

    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 6);
    const trendStartKey = trendStart.toISOString().slice(0, 10);
    const apptsTrend = await prisma.ticket.groupBy({
      by: ['date'],
      where: { date: { gte: trendStartKey } },
      _count: { date: true },
      orderBy: { date: 'asc' }
    });
    const trendMap = new Map(apptsTrend.map((item) => [item.date, item._count.date]));
    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return dateKey(date);
    });
    const dailyTrendData = trendDays.map((date) => ({
      date,
      count: trendMap.get(date) || 0
    }));

    const ticketsWithCenters = await hydrateTickets(await prisma.ticket.findMany());
    const waitTimeBuckets = ticketsWithCenters.reduce((acc, ticket) => {
      const centerName = ticket.center?.name || 'Unknown Center';
      const waitMins = Number.parseInt(ticket.waitTime || '0', 10);
      if (!acc[centerName]) {
        acc[centerName] = { total: 0, count: 0 };
      }
      if (Number.isFinite(waitMins)) {
        acc[centerName].total += waitMins;
        acc[centerName].count += 1;
      }
      return acc;
    }, {});
    const waitTimesData = Object.entries(waitTimeBuckets).map(([center, values]) => ({
      center,
      avgWait: values.count ? Math.round(values.total / values.count) : 0
    }));

    const totalTickets = await prisma.ticket.count();
    const serviceDistribution = appointmentsByServiceData.map(item => ({
      name: item.service,
      percentage: totalTickets > 0 ? Math.round((item.count / totalTickets) * 100) : 0
    }));

    const [dailyBookings, weeklyBookings, monthlyBookings] = await Promise.all([
      prisma.ticket.count({ where: { date: todayStr } }),
      prisma.ticket.count({ where: { date: { gte: dateKey(weekStart) } } }),
      prisma.ticket.count({ where: { date: { gte: dateKey(monthStart) } } })
    ]);

    const mostActiveCenterAgg = await prisma.ticket.groupBy({
      by: ['center'],
      _count: { center: true },
      orderBy: { _count: { center: 'desc' } },
      take: 1
    });
    const mostActiveCenterDoc = mostActiveCenterAgg[0]?.center
      ? await prisma.center.findUnique({ where: { id: mostActiveCenterAgg[0].center }, select: { name: true } })
      : null;

    const statusCountsAgg = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    const statusCounts = statusCountsAgg.map((item) => ({
      status: item.status,
      count: item._count.status
    }));

    const queueAverages = await prisma.queueHistory.aggregate({
      _avg: {
        waitTime: true,
        serviceTime: true
      }
    });

    return {
      appointmentsByService: appointmentsByServiceData,
      dailyTrend: dailyTrendData,
      waitTimesByCenter: waitTimesData,
      serviceDistribution,
      bookingsSummary: {
        daily: dailyBookings,
        weekly: weeklyBookings,
        monthly: monthlyBookings
      },
      mostActiveCenter: {
        name: mostActiveCenterDoc?.name || 'Not available',
        count: mostActiveCenterAgg[0]?._count?.center || 0
      },
      queuePerformance: {
        statusCounts,
        avgWaitTime: Math.round(queueAverages?._avg?.waitTime || 0),
        avgServiceTime: Math.round(queueAverages?._avg?.serviceTime || 0)
      }
    };
  }

  static async getPublicHomeStats() {
    const [appointmentsBooked, happyCitizens, serviceCenters, ratingAgg] = await Promise.all([
      prisma.ticket.count(),
      prisma.user.count({ where: { role: { in: ['citizen', 'user'] } } }),
      prisma.center.count(),
      prisma.feedback.aggregate({
        _avg: { rating: true },
        _count: { rating: true }
      })
    ]);

    const avgRating = Number(ratingAgg?._avg?.rating || 0);
    const ratingCount = Number(ratingAgg?._count?.rating || 0);
    const satisfactionRate = ratingCount > 0
      ? Math.max(0, Math.min(100, Math.round((avgRating / 5) * 100)))
      : 0;

    return {
      appointmentsBooked,
      happyCitizens,
      serviceCenters,
      satisfactionRate,
      updatedAt: new Date().toISOString()
    };
  }
}
