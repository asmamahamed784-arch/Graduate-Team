import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useRealtimeQueue } from './useRealtimeQueue';
import { useNotification } from './useNotification';
import { apiClient } from '../api/apiClient';
import api from '../api/axiosInstance';

/**
 * Custom dashboard logic hook aggregating user, operator, and administrator roles.
 * Supplies structured stats, timelines, filter hooks, and centralized state transitions.
 */
export const useDashboard = () => {
  const { user, role, isUser, isOperator, isAdmin } = useAuth();
  const centerName = typeof user?.center === 'object' ? user.center?.name : user?.center;
  const queueCenterName = isOperator ? (centerName || 'Banaadir National ID Center') : null;
  const { tickets, loading: queueLoading, callNextTicket, holdTicket, completeTicket, refreshQueue } = useRealtimeQueue(
    queueCenterName,
    true // Activate real-time loop on dashboards
  );
  const { notifications, unreadCount, markAllRead } = useNotification();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [operatorDashboardStats, setOperatorDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatsAndLogs = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      if (isAdmin) {
        const statsRes = await apiClient.get('/api/reports/stats');
        setStats(statsRes.data || null);
        const auditsRes = await apiClient.get('/api/logs/list');
        setLogs(auditsRes.data || []);
      } else {
        setStats(null);
        setLogs([]);
      }

      if (isOperator) {
        const operatorStatsRes = await apiClient.get('/api/operator/dashboard');
        setOperatorDashboardStats(operatorStatsRes.data || null);
      } else {
        setOperatorDashboardStats(null);
      }
    } catch {
      setStats(null);
      setLogs([]);
      setOperatorDashboardStats(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [isAdmin, isOperator]);

  useEffect(() => {
    fetchStatsAndLogs(true);
    const intervalId = window.setInterval(() => {
      fetchStatsAndLogs(false);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [fetchStatsAndLogs]);

  const refreshDashboard = useCallback(async () => {
    await fetchStatsAndLogs(false);
  }, [fetchStatsAndLogs]);

  const handleCallNextTicket = useCallback(async (counter) => {
    await callNextTicket(counter);
    await refreshDashboard();
  }, [callNextTicket, refreshDashboard]);

  const handleHoldTicket = useCallback(async (ticketRef) => {
    await holdTicket(ticketRef);
    await refreshDashboard();
  }, [holdTicket, refreshDashboard]);

  const handleCompleteTicket = useCallback(async (ticketRef) => {
    await completeTicket(ticketRef);
    await refreshDashboard();
  }, [completeTicket, refreshDashboard]);

  const handleCancelTicket = useCallback(async (ticketRef) => {
    const ticket = operatorDashboardStats?.allCenterTickets?.find((entry) => entry.ref === ticketRef);
    if (!ticket?.id) return;
    await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Cancelled', cancellationReason: 'Cancelled by operator.' });
    await refreshDashboard();
  }, [operatorDashboardStats, refreshDashboard]);

  const handleNoShow = useCallback(async (ticketRef) => {
    const ticket = operatorDashboardStats?.allCenterTickets?.find((entry) => entry.ref === ticketRef);
    if (!ticket?.id) return;
    await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Cancelled', cancellationReason: 'No show.' });
    await refreshDashboard();
  }, [operatorDashboardStats, refreshDashboard]);

  // Memoize User Stats
  const userStats = useMemo(() => {
    if (!isUser) return null;
    const myTickets = tickets;
    const upcoming = myTickets.filter((t) => t.status === 'Waiting' || t.status === 'Being Served');
    const completed = myTickets.filter((t) => t.status === 'Completed');
    const waits = myTickets
      .map((ticket) => Number.parseInt(ticket.waitTime || ticket.estimatedWait || '0', 10))
      .filter((wait) => Number.isFinite(wait) && wait > 0);
    const avgWait = waits.length ? `${Math.round(waits.reduce((sum, wait) => sum + wait, 0) / waits.length)} min` : '0 min';

    return {
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      avgWaitTime: avgWait,
      upcomingTickets: upcoming,
      completedTickets: completed,
      recentActivity: myTickets.slice(0, 5)
    };
  }, [isUser, tickets]);

  // Memoize Operator Stats
  const operatorStats = useMemo(() => {
    if (!isOperator) return null;

    return {
      currentlyServing: operatorDashboardStats?.currentlyServing || null,
      currentlyServingTicket: operatorDashboardStats?.currentlyServing || null,
      ticketsWaitingCount: operatorDashboardStats?.ticketsWaitingCount ?? 0,
      ticketsWaiting: operatorDashboardStats?.ticketsWaiting || [],
      servedTodayCount: operatorDashboardStats?.servedTodayCount ?? 0,
      servedToday: operatorDashboardStats?.servedToday || [],
      avgServiceTime: operatorDashboardStats?.avgServiceTime || '--',
      allCenterTickets: operatorDashboardStats?.allCenterTickets || []
    };
  }, [isOperator, operatorDashboardStats]);

  // Memoize Admin Stats
  const adminStats = useMemo(() => {
    if (!isAdmin || !stats) return null;
    return {
      totalUsers: stats.totalCitizens || 0,
      activeServices: stats.activeServices || 0,
      serviceCenters: stats.serviceCenters || 0,
      todayAppointmentsCount: stats.dailyVisitors || 0,
      queueEfficiency: stats.efficiency || '0%',
      systemUptime: 'Online',
      averageWaitTimeGlobal: '0 min',
      recentLogs: stats.recentActivities || []
    };
  }, [isAdmin, stats]);

  const dashboardState = useMemo(() => {
    return {
      role,
      user,
      loading: loading || queueLoading,
      userStats,
      operatorStats,
      adminStats,
      notifications,
      unreadCount,
      logs,
      tickets,
      actions: {
        callNextTicket: handleCallNextTicket,
        holdTicket: handleHoldTicket,
        completeTicket: handleCompleteTicket,
        cancelTicket: handleCancelTicket,
        markNoShow: handleNoShow,
        markAllRead,
        refreshQueue,
        refreshLogs: () => fetchStatsAndLogs(true)
      }
    };
  }, [
    role,
    user,
    loading,
    queueLoading,
    userStats,
    operatorStats,
    adminStats,
    notifications,
    unreadCount,
    logs,
    tickets,
    handleCallNextTicket,
    handleHoldTicket,
    handleCompleteTicket,
    handleCancelTicket,
    handleNoShow,
    markAllRead,
    refreshQueue,
    fetchStatsAndLogs
  ]);

  return dashboardState;
};
