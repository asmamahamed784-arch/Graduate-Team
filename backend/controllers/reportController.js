import prisma from '../config/prisma.js';
import { getAssignedCenterId, normalizeRole } from '../utils/rbac.js';

const STAFF_CENTER_ROLES = ['operator', 'super_operator', 'center_manager'];

const dateKey = (date) => date.toISOString().slice(0, 10);

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
  waitTime: ticket.waitTime || '0 min',
  counter: ticket.counter || '--',
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  date: ticket.date,
  timeSlot: ticket.timeSlot,
  queueNumber: ticket.queueNumber,
  registrationDetails: ticket.registrationDetails,
  updateDetails: ticket.updateDetails,
  replacementDetails: ticket.replacementDetails
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

// @desc    Get dashboard metrics and stats
// @route   GET /api/reports/stats
// @access  Private/Operator or Admin
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = dateKey(today);
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
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] }, status: { in: ['active', 'Active'] } } }),
      prisma.user.count({ where: { role: { in: ['operator', 'super_operator', 'center_manager'] }, status: { in: ['pending_approval', 'Pending Approval'] } } }),
      prisma.service.count({ where: { status: 'Active' } }),
      prisma.center.count(),
      prisma.ticket.count({ where: { date: todayStr } }),
      prisma.ticket.count({ where: { status: 'Completed', date: todayStr } }),
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

    const mostActiveCenterAgg = await prisma.ticket.groupBy({
      by: ['center'],
      _count: { center: true },
      orderBy: { _count: { center: 'desc' } },
      take: 1
    });
    const mostActiveCenterDoc = mostActiveCenterAgg[0]?.center
      ? await prisma.center.findUnique({ where: { id: mostActiveCenterAgg[0].center }, select: { name: true } })
      : null;

    // Calculate today's queue efficiency from resolved tickets only.
    const cancelledCount = await prisma.ticket.count({ where: { status: 'Cancelled', date: todayStr } });
    const totalTodayResolved = completedServices + cancelledCount;
    const efficiency = totalTodayResolved > 0 ? Math.round((completedServices / totalTodayResolved) * 100) : 0;

    // Recent activity list (from tickets today)
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

    return res.json({
      success: true,
      data: {
        totalAppointments,
        totalBookings: totalAppointments,
        activeQueues,
        waitingQueue,
        nowServing,
        totalCitizens,
        totalUsers: totalCitizens,
        totalOperators,
        activeOperators,
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
        completedServices,
        cancelledAppointments,
        lostIdRequests,
        updateRequests,
        averageWaitingTime: Math.round(queueTimeAverages._avg.waitTime || 0),
        averageServiceTime: Math.round(queueTimeAverages._avg.serviceTime || 0),
        efficiency: `${efficiency}%`,
        queueEfficiency: `${efficiency}%`,
        systemUptime: 'Online',
        recentActivities
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get operator dashboard metrics for the assigned center
// @route   GET /api/reports/operator-dashboard
// @access  Private/Operator or Admin
export const getOperatorDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = dateKey(today);
    const userAssignedCenterId = getAssignedCenterId(req.user);
    const requestedCenterId = req.query.centerId || '';
    const role = normalizeRole(req.user.role);

    let assignedCenterId = requestedCenterId || userAssignedCenterId;
    if (STAFF_CENTER_ROLES.includes(role)) {
      if (!userAssignedCenterId) {
        return res.status(403).json({ success: false, message: 'Operator account is not assigned to a center.' });
      }
      if (requestedCenterId && requestedCenterId !== userAssignedCenterId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access another center data.' });
      }
      assignedCenterId = userAssignedCenterId;
    }

    const query = {};
    if (assignedCenterId) {
      query.center = assignedCenterId;
    }

    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: query,
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 250
    }));
    const centerDashboardCounts = await buildCenterDashboardCounts(query, todayStr);

    const currentlyServing = tickets.find((ticket) => ticket.status === 'Being Served') || null;
    const waitingTickets = tickets.filter((ticket) => ticket.status === 'Waiting');
    const servedToday = tickets.filter((ticket) => ticket.status === 'Completed');

    const serviceTimeAverage = assignedCenterId
      ? await prisma.queueHistory.aggregate({
          where: { center: assignedCenterId, date: todayStr },
          _avg: { serviceTime: true }
        })
      : { _avg: { serviceTime: null } };
    const avgServiceTime = serviceTimeAverage._avg.serviceTime
      ? `${Math.round(serviceTimeAverage._avg.serviceTime)} min`
      : '--';

    return res.json({
      success: true,
      data: {
        centerName: currentlyServing?.center?.name || tickets[0]?.center?.name || null,
        currentlyServing: currentlyServing ? formatTicketForDashboard(currentlyServing) : null,
        ticketsWaitingCount: waitingTickets.length,
        ticketsWaiting: waitingTickets.map(formatTicketForDashboard),
        servedTodayCount: servedToday.length,
        servedToday: servedToday.map(formatTicketForDashboard),
        avgServiceTime,
        centerStats: centerDashboardCounts,
        todayStats: centerDashboardCounts.today,
        allCenterTickets: tickets.map(formatTicketForDashboard)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get operator queue tickets for the assigned center
// @route   GET /api/operator/queue
// @access  Private/Operator or Admin
export const getOperatorQueue = async (req, res) => {
  try {
    const todayStr = dateKey(new Date());
    const assignedCenterId = getAssignedCenterId(req.user);

    if (!assignedCenterId) {
      return res.status(403).json({ success: false, message: 'Operator account is not assigned to a center.' });
    }

    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: {
        center: assignedCenterId,
        status: { in: ['Waiting', 'Being Served', 'On Hold'] },
        date: todayStr
      },
      orderBy: { createdAt: 'asc' }
    }));

    const currentlyServing = tickets.find((ticket) => ticket.status === 'Being Served') || null;
    const waitingTickets = tickets.filter((ticket) => ticket.status === 'Waiting');
    const onHoldTickets = tickets.filter((ticket) => ticket.status === 'On Hold');

    return res.json({
      success: true,
      data: {
        centerName: req.user?.center?.name || tickets[0]?.center?.name || null,
        currentlyServing: currentlyServing ? formatTicketForDashboard(currentlyServing) : null,
        waitingCount: waitingTickets.length,
        waitingTickets: waitingTickets.map(formatTicketForDashboard),
        onHoldCount: onHoldTickets.length,
        onHoldTickets: onHoldTickets.map(formatTicketForDashboard),
        allActiveTickets: tickets.map(formatTicketForDashboard)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed charts and analytics reports
// @route   GET /api/reports/analytics
// @access  Private/Admin
export const getReportsAndAnalytics = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = dateKey(today);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Appointments by Service
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

    // 2. Daily Appointments Trend (last 7 days)
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

    // 3. Wait Times by Center, based on stored ticket waitTime values.
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

    // 4. Service Distribution (Pie chart percentages)
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

    return res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

