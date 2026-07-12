import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  FaPhoneAlt,
  FaPause,
  FaUsers,
  FaClock,
  FaCheckDouble,
  FaArrowRight,
  FaTicketAlt,
} from 'react-icons/fa';
import { useQueue } from '../hooks';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const statusBadge = (status) => {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold';
  if (status === 'Being Served') return `${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400`;
  if (status === 'Waiting') return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400`;
  if (status === 'On Hold') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`;
  return `${base} bg-gray-700 text-gray-300`;
};

const QueueManagement = () => {
  const { tickets, loading, callNextTicket, holdTicket } = useQueue();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  const filteredTickets = useMemo(() => {
    if (filter === 'waiting') {
      return tickets.filter((t) => t.status === 'Waiting');
    }
    if (filter === 'completed') {
      return tickets.filter((t) => t.status === 'Completed');
    }
    return tickets;
  }, [filter, tickets]);

  const nowServing = filteredTickets.find((t) => t.status === 'Being Served');
  const waitingTickets = filteredTickets.filter((t) => t.status === 'Waiting' || t.status === 'On Hold');
  const nextUp = waitingTickets.filter((t) => t.status === 'Waiting').slice(0, 3);
  const avgWait = waitingTickets.length
    ? Math.round(waitingTickets.reduce((a, t) => a + t.wait, 0) / waitingTickets.length)
    : 0;
  const servedCount = filteredTickets.filter((t) => t.status === 'Completed').length;

  const handleCallNext = useCallback(() => {
    callNextTicket('01');
  }, [callNextTicket]);

  const handleHold = useCallback(() => {
    if (!nowServing) return;
    holdTicket(nowServing.ref);
  }, [holdTicket, nowServing]);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8 text-white"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              Queue Management
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-3 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                LIVE
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filter === 'waiting'
                ? 'Showing waiting tickets for the current center.'
                : filter === 'completed'
                  ? 'Showing completed tickets for the current center.'
                  : 'Current queue for the Banaadir National ID Center.'}
            </p>
            {loading && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Syncing queue...</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCallNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg transition-all text-sm"
            >
              <FaPhoneAlt /> Call Next
            </button>
            <button
              onClick={handleHold}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F59E0B] hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg transition-all text-sm"
            >
              <FaPause /> Hold Current
            </button>
          </div>
        </motion.div>

        {/* Now Serving + Next 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Now Serving */}
          <motion.div
            variants={item}
            className="lg:col-span-1 bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-black/10 border border-slate-800 flex flex-col items-center justify-center text-center"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-[#4189DD] mb-2">Now Serving</p>
            <AnimatePresence mode="wait">
              {nowServing ? (
                <motion.div
                  key={nowServing.ref}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-4xl sm:text-5xl font-extrabold tracking-wide">{nowServing.ref}</p>
                  <p className="text-slate-300 text-sm mt-2">{nowServing.service}</p>
                  <p className="text-slate-400 text-xs mt-1">{nowServing.center}</p>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl font-bold text-slate-400"
                >
                  --
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Next Up */}
          {nextUp.map((t, i) => (
            <motion.div
              key={t.ref}
              variants={item}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 flex flex-col items-center justify-center text-center border border-gray-100 dark:border-gray-700"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                Next #{i + 1}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{t.ref}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.service}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.center}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 font-medium">
                <FaClock /> {t.wait} min wait
              </div>
            </motion.div>
          ))}
        </div>

        {/* Queue Table */}
        <motion.div variants={item} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaTicketAlt className="text-yellow-500" />
              Tickets in Queue
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {waitingTickets.length} tickets in queue
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {['Reference', 'Service', 'Center', 'Position', 'Wait Time', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                <AnimatePresence>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((t, i) => (
                      <motion.tr
                        key={t.ref}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.3 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-3 font-semibold text-blue-700 dark:text-blue-400">{t.ref}</td>
                        <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{t.service}</td>
                        <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{t.center}</td>
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                          {t.status === 'Being Served' ? (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                              <FaArrowRight /> Serving
                            </span>
                          ) : (
                            `#${i + 1}`
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{t.wait} min</td>
                        <td className="px-6 py-3"><span className={statusBadge(t.status)}>{t.status}</span></td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No tickets to display for this filter.
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
              <FaUsers className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{waitingTickets.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Waiting Now</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <FaClock className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{avgWait} min</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Average Wait</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <FaCheckDouble className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{servedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Served Today</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default QueueManagement;
