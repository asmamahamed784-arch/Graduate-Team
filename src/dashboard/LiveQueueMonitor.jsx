import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiRefreshCw,
  FiClock,
  FiBriefcase,
  FiUser,
} from 'react-icons/fi';

const DEFAULT_TICKETS = [
  { ref: 'NQS-1023', service: 'National ID Registration', position: 1, status: 'Being Served', waitTime: '2 min' },
  { ref: 'NQS-1024', service: 'National ID Registration', position: 2, status: 'Next', waitTime: '5 min' },
  { ref: 'NQS-1025', service: 'National ID Registration', position: 3, status: 'Waiting', waitTime: '12 min' },
  { ref: 'NQS-1026', service: 'National ID Registration', position: 4, status: 'Waiting', waitTime: '18 min' },
  { ref: 'NQS-1027', service: 'National ID Registration', position: 5, status: 'Waiting', waitTime: '24 min' },
];

const statusConfig = {
  'Being Served': {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    pulse: true,
  },
  Next: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    pulse: false,
  },
  Waiting: {
    color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300',
    pulse: false,
  },
  'On Hold': {
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    pulse: false,
  },
};

const positionColors = [
  'bg-emerald-500 text-white',
  'bg-blue-500 text-white',
  'bg-slate-400 text-white dark:bg-slate-600',
  'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200',
  'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
];

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.Waiting;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {status}
    </span>
  );
}

export default function LiveQueueMonitor({
  initialTickets = null,
  refreshInterval = 5000,
  title = 'Live Queue Monitor',
}) {
  const [tickets, setTickets] = useState(initialTickets || DEFAULT_TICKETS);
  const [countdown, setCountdown] = useState(Math.floor(refreshInterval / 1000));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const countdownRef = useRef(null);

  const refreshQueueMovement = useCallback(() => {
    setIsRefreshing(true);

    setTimeout(() => {
      setTickets((prev) => {
        const updated = prev.map((t) => ({ ...t }));

        // Find the currently being served ticket
        const servingIdx = updated.findIndex((t) => t.status === 'Being Served');
        const nextIdx = updated.findIndex((t) => t.status === 'Next');

        // Randomly decide action
        const action = Math.random();

        if (action < 0.35 && servingIdx !== -1 && nextIdx !== -1) {
          // Complete current service, advance next
          updated[servingIdx].status = 'Being Served'; // keep showing
          updated[nextIdx].status = 'Being Served';
          updated[servingIdx].position = 0; // will be filtered

          // Promote waiting tickets
          const waitingTickets = updated.filter(
            (t) => t.status === 'Waiting' || t.status === 'On Hold'
          );
          if (waitingTickets.length > 0) {
            const firstWaiting = updated.find(
              (t) => t.status === 'Waiting' && t !== updated[nextIdx]
            );
            if (firstWaiting) {
              firstWaiting.status = 'Next';
            }
          }

          // Remove completed ticket and reindex
          const remaining = updated.filter((t) => t.position > 0);
          remaining.forEach((t, i) => (t.position = i + 1));
          return remaining.length > 0 ? remaining : prev;
        } else if (action < 0.55) {
          // Decrease wait times slightly
          updated.forEach((t) => {
            const minutes = parseInt(t.waitTime) || 0;
            if (minutes > 1 && t.status !== 'Being Served') {
              t.waitTime = `${Math.max(1, minutes - Math.ceil(Math.random() * 2))} min`;
            }
          });
          return updated;
        } else if (action < 0.7 && updated.length > 0) {
          // Occasionally put someone on hold
          const waitingList = updated.filter((t) => t.status === 'Waiting');
          if (waitingList.length > 1) {
            const holdTarget = waitingList[Math.floor(Math.random() * waitingList.length)];
            if (holdTarget) {
              holdTarget.status = holdTarget.status === 'On Hold' ? 'Waiting' : 'On Hold';
            }
          }
          return updated;
        }

        // No change
        return updated;
      });

      setIsRefreshing(false);
    }, 400);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      refreshQueueMovement();
      setCountdown(Math.floor(refreshInterval / 1000));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, refreshQueueMovement]);

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : Math.floor(refreshInterval / 1000)));
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [refreshInterval]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>

          {/* Live dot */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">Live</span>
          </div>
        </div>

        {/* Refresh Countdown */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <FiRefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`}
          />
          <span>
            {isRefreshing ? 'Auto-refreshing...' : `Next update in ${countdown}s`}
          </span>
        </div>
      </div>

      {/* Ticket List */}
      <div className="max-h-[28rem] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {tickets.map((ticket) => (
            <motion.div
              key={ticket.ref}
              layout
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30, height: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="px-6 py-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Position Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    positionColors[Math.min(ticket.position - 1, positionColors.length - 1)]
                  }`}
                >
                  {ticket.position}
                </div>

                {/* Ticket Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800 dark:text-white text-sm">
                      {ticket.ref}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <FiBriefcase className="w-3 h-3" />
                      {ticket.service}
                    </span>
                  </div>
                </div>

                {/* Wait Time */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 shrink-0">
                  <FiClock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{ticket.waitTime}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <FiUser className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No active tickets</p>
            <p className="text-xs mt-1 opacity-60">Queue is currently empty</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50/80 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Showing {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} in queue
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Refresh interval: {refreshInterval / 1000}s
        </span>
      </div>
    </motion.div>
  );
}
