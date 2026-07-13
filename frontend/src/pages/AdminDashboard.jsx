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
  HiOutlineUsers,
  HiOutlineSquares2X2,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineBolt,
  HiOutlineServer,
  HiOutlineCog6Tooth,
  HiOutlineChartBar,
  HiOutlineShieldCheck,
  HiOutlineAdjustmentsHorizontal,
  HiOutlineClipboardDocumentCheck,
  HiOutlineQrCode,
  HiOutlineArrowRight,
} from 'react-icons/hi2';

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

const statAccents = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
};

const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]';

const AdminDashboard = () => {
  const { user, loading, adminStats, tickets } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
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
    { label: 'Citizen Accounts', value: totalUsers.toString(), icon: HiOutlineUsers, to: '/citizen-management', accent: 'blue' },
    { label: 'Active Services', value: activeServices.toString(), icon: HiOutlineSquares2X2, to: '/service-management', accent: 'emerald' },
    { label: 'Banaadir Centers', value: serviceCenters.toString(), icon: HiOutlineBuildingOffice2, to: '/center-management', accent: 'indigo' },
    { label: "Today's Tickets", value: todayAppointments.toString(), icon: HiOutlineCalendarDays, to: { pathname: '/admin-appointments', search: '?date=today' }, accent: 'amber' },
    { label: 'Completion Rate', value: completionRate, icon: HiOutlineBolt, to: '/reports', accent: 'violet' },
    { label: 'API Status', value: systemUptime, icon: HiOutlineServer, to: '/settings', accent: 'teal' },
  ];

  const quickLinks = [
    { label: 'Manage Services', desc: 'Review the active National ID service', icon: HiOutlineCog6Tooth, to: '/service-management' },
    { label: 'Manage Centers', desc: 'Banaadir center locations & schedules', icon: HiOutlineBuildingOffice2, to: '/center-management' },
    { label: 'View Reports', desc: 'Appointment and queue analytics', icon: HiOutlineChartBar, to: '/reports' },
    { label: 'QR Verification', desc: 'Scan and verify appointment tickets', icon: HiOutlineQrCode, to: '/dashboard/admin/qr-scan' },
    { label: 'Audit Logs', desc: 'Recent system actions', icon: HiOutlineShieldCheck, to: '/logs' },
    { label: 'Settings', desc: 'Account and system options', icon: HiOutlineAdjustmentsHorizontal, to: '/settings' },
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
        borderColor: 'rgba(37, 99, 235, 1)',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
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
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
    },
  };

  return (
    <motion.div
      className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Welcome banner */}
      <motion.div
        variants={item}
        className="nqs-portal-hero relative overflow-hidden rounded-2xl bg-[#082A55] bg-gradient-to-br from-[#082A55] to-[#0B3A75] p-6 text-white shadow-sm sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Administration</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Welcome back, {adminName}
            </h1>
            <p className="mt-2 text-sm text-blue-100">{today}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-bold text-emerald-300">System Online</span>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statsCards.map((s) => (
          <motion.div key={s.label} variants={item} className="h-full">
            <Link
              to={s.to}
              className={`${cardClass} group flex h-full items-center gap-4 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl p-3 ${statAccents[s.accent]}`}>
                <s.icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
              <HiOutlineArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <motion.div variants={item} className={`${cardClass} overflow-hidden lg:col-span-3`}>
          <Link to="/reports" className="block h-full transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-[#1d355f]">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Appointments This Week</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                Full report <HiOutlineArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="h-56 p-4">
              <Line data={chartData} options={chartOptions} />
            </div>
          </Link>
        </motion.div>

        <motion.div variants={item} className={`${cardClass} overflow-hidden lg:col-span-2`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-[#1d355f]">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
              <HiOutlineShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Recent Activity
            </h2>
            <Link to="/logs" className="text-xs font-bold text-blue-700 dark:text-blue-300">View all</Link>
          </div>
          <div className="p-4">
            <ul className="space-y-1.5">
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
                      <Link to="/logs" className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/15">
                          <HiOutlineClipboardDocumentCheck className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs leading-snug text-slate-800 dark:text-slate-200">
                            <span className="font-bold">{actor}</span>: {e.action}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{details}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                            {timestamp ? new Date(timestamp).toLocaleString() : 'Recent activity'}
                          </p>
                        </div>
                      </Link>
                    </motion.li>
                  );
                })
              ) : (
                <p className="p-2 text-sm text-slate-500 dark:text-slate-400">No recent logs recorded.</p>
              )}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Quick links */}
      <motion.div variants={item}>
        <h2 className="mb-3 text-base font-black text-slate-900 dark:text-white">Quick Links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={`${cardClass} group flex items-center gap-4 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md shadow-blue-900/20 transition-transform group-hover:scale-105">
                <link.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">{link.label}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{link.desc}</p>
              </div>
              <HiOutlineArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminDashboard;
