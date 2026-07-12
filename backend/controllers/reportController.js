import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Center from '../models/Center.js';
import QueueHistory from '../models/QueueHistory.js';
import { getAssignedCenterId } from '../utils/rbac.js';

const dateKey = (date) => date.toISOString().slice(0, 10);

const formatTicketForDashboard = (ticket) => ({
  id: ticket._id,
  ref: ticket.ref,
  service: ticket.service?.name || 'Unknown Service',
  citizenName: ticket.citizenName || 'Unknown Citizen',
  center: ticket.center?.name || null,
  status: ticket.status,
  waitTime: ticket.waitTime || '0 min',
  counter: ticket.counter || '--',
  createdAt: ticket.createdAt,
  calledAt: ticket.calledAt,
  completedAt: ticket.completedAt,
  date: ticket.date
});

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

    const totalAppointments = await Ticket.countDocuments({});
    const activeQueues = await Ticket.countDocuments({
      status: { $in: ['Waiting', 'Being Served', 'On Hold'] },
      date: todayStr
    });
    const totalCitizens = await User.countDocuments({ role: { $in: ['citizen', 'user'] } });
    const activeServices = await Service.countDocuments({ status: 'Active' });
    const serviceCenters = await Center.countDocuments({});
    const dailyVisitors = await Ticket.countDocuments({ date: todayStr });
    const completedServices = await Ticket.countDocuments({ status: 'Completed', date: todayStr });
    const weeklyBookings = await Ticket.countDocuments({ date: { $gte: dateKey(weekStart) } });
    const monthlyBookings = await Ticket.countDocuments({ date: { $gte: dateKey(monthStart) } });

    const mostActiveCenterAgg = await Ticket.aggregate([
      { $group: { _id: '$center', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostActiveCenterDoc = mostActiveCenterAgg[0]?._id
      ? await Center.findById(mostActiveCenterAgg[0]._id).select('name')
      : null;

    // Calculate today's queue efficiency from resolved tickets only.
    const cancelledCount = await Ticket.countDocuments({ status: 'Cancelled', date: todayStr });
    const totalTodayResolved = completedServices + cancelledCount;
    const efficiency = totalTodayResolved > 0 ? Math.round((completedServices / totalTodayResolved) * 100) : 0;

    // Recent activity list (from tickets today)
    const recentTickets = await Ticket.find({})
      .populate('service')
      .populate('center')
      .sort({ updatedAt: -1 })
      .limit(5);

    const recentActivities = recentTickets.map((t) => {
      let actionText = '';
      if (t.status === 'Waiting') actionText = `Ticket ${t.ref} booked for ${t.service.name}`;
      else if (t.status === 'Being Served') actionText = `Ticket ${t.ref} is being served at ${t.counter}`;
      else if (t.status === 'Completed') actionText = `Ticket ${t.ref} completed service session`;
      else if (t.status === 'Cancelled') actionText = `Ticket ${t.ref} cancelled booking`;
      else if (t.status === 'On Hold') actionText = `Ticket ${t.ref} placed on hold`;

      return {
        id: t._id,
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
        activeQueues,
        totalCitizens,
        activeServices,
        serviceCenters,
        dailyVisitors,
        dailyBookings: dailyVisitors,
        weeklyBookings,
        monthlyBookings,
        mostActiveCenter: {
          name: mostActiveCenterDoc?.name || 'Not available',
          count: mostActiveCenterAgg[0]?.count || 0
        },
        completedServices,
        efficiency: `${efficiency}%`,
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
    const assignedCenterId = req.query.centerId || getAssignedCenterId(req.user);

    const query = { date: todayStr };
    if (assignedCenterId) {
      query.center = assignedCenterId;
    }

    const tickets = await Ticket.find(query)
      .populate('service', 'name')
      .populate('center', 'name')
      .sort({ createdAt: 1 });

    const currentlyServing = tickets.find((ticket) => ticket.status === 'Being Served') || null;
    const waitingTickets = tickets.filter((ticket) => ticket.status === 'Waiting');
    const servedToday = tickets.filter((ticket) => ticket.status === 'Completed');

    const serviceTimes = servedToday
      .map((ticket) => {
        const start = ticket.calledAt ? new Date(ticket.calledAt).getTime() : null;
        const end = ticket.completedAt ? new Date(ticket.completedAt).getTime() : null;
        return start && end && end > start ? Math.round((end - start) / 60000) : null;
      })
      .filter((value) => Number.isFinite(value));

    const avgServiceTime = serviceTimes.length
      ? `${Math.round(serviceTimes.reduce((sum, value) => sum + value, 0) / serviceTimes.length)} min`
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

    const tickets = await Ticket.find({
      center: assignedCenterId,
      status: { $in: ['Waiting', 'Being Served', 'On Hold'] },
      date: todayStr
    })
      .populate('service', 'name')
      .populate('center', 'name')
      .sort({ createdAt: 1 });

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
    const apptsByService = await Ticket.aggregate([
      {
        $group: {
          _id: '$service',
          count: { $sum: 1 }
        }
      }
    ]);
    const populatedApptsByService = await Service.populate(apptsByService, { path: '_id', select: 'name' });
    const appointmentsByServiceData = populatedApptsByService.map(item => ({
      service: item._id ? item._id.name : 'Unknown Service',
      count: item.count
    }));

    // 2. Daily Appointments Trend (last 7 days)
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 6);
    const trendStartKey = trendStart.toISOString().slice(0, 10);
    const apptsTrend = await Ticket.aggregate([
      {
        $match: {
          date: { $gte: trendStartKey }
        }
      },
      {
        $group: {
          _id: '$date',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const trendMap = new Map(apptsTrend.map((item) => [item._id, item.count]));
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
    const ticketsWithCenters = await Ticket.find({}).populate('center');
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
    const totalTickets = await Ticket.countDocuments({});
    const serviceDistribution = appointmentsByServiceData.map(item => ({
      name: item.service,
      percentage: totalTickets > 0 ? Math.round((item.count / totalTickets) * 100) : 0
    }));

    const [dailyBookings, weeklyBookings, monthlyBookings] = await Promise.all([
      Ticket.countDocuments({ date: todayStr }),
      Ticket.countDocuments({ date: { $gte: dateKey(weekStart) } }),
      Ticket.countDocuments({ date: { $gte: dateKey(monthStart) } })
    ]);

    const mostActiveCenterAgg = await Ticket.aggregate([
      { $group: { _id: '$center', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostActiveCenterDoc = mostActiveCenterAgg[0]?._id
      ? await Center.findById(mostActiveCenterAgg[0]._id).select('name')
      : null;

    const statusCountsAgg = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = statusCountsAgg.map((item) => ({
      status: item._id,
      count: item.count
    }));

    const queueAverages = await QueueHistory.aggregate([
      {
        $group: {
          _id: null,
          avgWaitTime: { $avg: '$waitTime' },
          avgServiceTime: { $avg: '$serviceTime' }
        }
      }
    ]);

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
          count: mostActiveCenterAgg[0]?.count || 0
        },
        queuePerformance: {
          statusCounts,
          avgWaitTime: Math.round(queueAverages[0]?.avgWaitTime || 0),
          avgServiceTime: Math.round(queueAverages[0]?.avgServiceTime || 0)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
