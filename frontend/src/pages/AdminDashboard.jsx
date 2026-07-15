import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useDashboard } from '../hooks';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  FaUsers,
  FaConciergeBell,
  FaBuilding,
  FaCalendarDay,
  FaBolt,
  FaServer,
  FaCogs,
  FaChartBar,
  FaUserShield,
  FaShieldAlt,
  FaSlidersH,
  FaClipboardCheck,
  FaQrcode,
} from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const AdminDashboard = () => {
  const { user, loading, adminStats, tickets } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const totalUsers = adminStats?.totalUsers || 0;
  const activeServices = adminStats?.activeServices || 0;
  const serviceCenters = adminStats?.serviceCenters || 0;
  const todayAppointments = adminStats?.todayAppointmentsCount || 0;
  const completionRate = adminStats?.queueEfficiency || '0%';
  const systemUptime = adminStats?.systemUptime || 'Online';
  const recentLogs = adminStats?.recentLogs || [];
  const adminName = user?.name || 'NQS Administrator';

  const statsCards = [
    { label: 'Citizen Accounts', value: totalUsers.toString(), icon: FaUsers, to: '/citizen-management', color: 'border-blue-500', iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Active Service', value: activeServices.toString(), icon: FaConciergeBell, to: '/service-management', color: 'border-green-500', iconBg: 'bg-green-100 dark:bg-green-900/40', iconColor: 'text-green-600 dark:text-green-400' },
    { label: 'Banaadir Centers', value: serviceCenters.toString(), icon: FaBuilding, to: '/center-management', color: 'border-indigo-500', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: "Today's Tickets", value: todayAppointments.toString(), icon: FaCalendarDay, to: { pathname: '/admin-appointments', search: '?date=today' }, color: 'border-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Completed Rate', value: completionRate, icon: FaBolt, to: '/reports', color: 'border-yellow-500', iconBg: 'bg-yellow-100 dark:bg-yellow-900/40', iconColor: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'API Status', value: systemUptime, icon: FaServer, to: '/settings', color: 'border-teal-500', iconBg: 'bg-teal-100 dark:bg-teal-900/40', iconColor: 'text-teal-600 dark:text-teal-400' },
  ];

  const quickLinks = [
    { label: 'Manage National ID Service', desc: 'Review the active National ID service', icon: FaCogs, to: '/service-management', bg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Manage Centers', desc: 'Manage Banaadir center locations', icon: FaBuilding, to: '/center-management', bg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
    { label: 'View Reports', desc: 'Appointment and queue numbers', icon: FaChartBar, to: '/reports', bg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400' },
    { label: 'QR Ticket Verification', desc: 'Scan and verify appointment tickets', icon: FaQrcode, to: '/dashboard/admin/qr-scan', bg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Manage Users', desc: 'Citizen profiles and permissions', icon: FaUserShield, to: '/profile', bg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Activity Logs', desc: 'Recent system actions', icon: FaShieldAlt, to: '/logs', bg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400' },
    { label: 'Settings', desc: 'Account and system options', icon: FaSlidersH, to: '/settings', bg: 'bg-teal-50 dark:bg-teal-900/20', iconColor: 'text-teal-600 dark:text-teal-400' },
  ];

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const weeklyLabels = lastSevenDays.map((date) => date.toLocaleDateString('en-US', { weekday: 'short' }));
  const weeklyCounts = lastSevenDays.map((date) => {
    const dayKey = date.toISOString().slice(0, 10);
    return (tickets || []).filter((ticket) => ticket.date === dayKey).length;
  });

  const chartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: 'Appointments',
        data: weeklyCounts,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#9ca3af', font: { size: 11 } },
        grid: { color: 'rgba(156,163,175,0.15)' },
      },
    },
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-2 dark:bg-gray-900 sm:p-3 lg:p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-none space-y-3">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Admin Dashboard</h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{today} - Admin: {adminName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
            </span>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Online</span>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {statsCards.map((s) => (
            <motion.div
              key={s.label}
              variants={item}
              className="h-full"
            >
              <Link
                to={s.to}
                className={`group flex h-full cursor-pointer items-center gap-3 rounded-lg border-l-4 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-800 ${s.color}`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${s.iconBg}`}>
                  <s.icon className={`text-base ${s.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Middle Row: Chart + Recent Activity */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Chart */}
          <motion.div variants={item} className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800 lg:col-span-3">
            <Link to="/reports" className="block h-full cursor-pointer transition-all hover:bg-gray-50 hover:shadow-lg dark:hover:bg-gray-700/40">
              <div className="border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Appointments This Week</h2>
              </div>
              <div className="h-52 p-3">
                <Line data={chartData} options={chartOptions} />
              </div>
            </Link>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={item} className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                <FaShieldAlt className="text-yellow-500" />
                Recent Activity
              </h2>
            </div>
            <div className="p-3">
              <ul className="space-y-2">
                {recentLogs.length > 0 ? (
                  recentLogs.map((e, i) => {
                    const actor = e.user || 'System';
                    const details = e.details || e.ref || e.status || 'Queue activity';
                    const timestamp = e.timestamp || e.time;
                    return (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="list-none"
                    >
                      <Link to="/logs" className="-m-1.5 flex cursor-pointer items-start gap-2 rounded-lg p-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60">
                        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                          <FaClipboardCheck className="text-xs text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs leading-snug text-gray-800 dark:text-gray-200"><span className="font-semibold">{actor}</span>: {e.action}</p>
                          <p className="mt-0.5 text-[11px] text-gray-400">{details}</p>
                          <p className="mt-0.5 text-[10px] text-gray-400">{timestamp ? new Date(timestamp).toLocaleString() : 'Recent activity'}</p>
                        </div>
                      </Link>
                    </motion.li>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent logs recorded.</p>
                )}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Quick Links */}
        <motion.div variants={item}>
          <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Quick Links</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={`${link.bg} group flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm transition-transform group-hover:scale-110 dark:bg-gray-700">
                  <link.icon className={`text-base ${link.iconColor}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{link.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
