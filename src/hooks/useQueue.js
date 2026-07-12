import { useContext, useMemo, useCallback } from 'react';
import { QueueContext } from '../context/QueueContext';

/**
 * Custom hook connecting components to the shared global QueueContext.
 * Filters queue elements by center name and exposes call, hold, and complete actions.
 */
export const useQueue = (centerName = 'Banaadir National ID Center') => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }

  const {
    tickets,
    loading,
    error,
    addTicket,
    callNextTicket,
    holdTicket,
    completeTicket,
    refreshQueue
  } = context;

  // Filter tickets by center name
  const filteredTickets = useMemo(() => {
    return centerName ? tickets.filter(t => t.center === centerName) : tickets;
  }, [tickets, centerName]);

  const addTicketForCenter = useCallback((serviceName, citizenName) => {
    return addTicket(serviceName, citizenName, centerName);
  }, [addTicket, centerName]);

  const callNextTicketForCenter = useCallback((counter) => {
    return callNextTicket(counter, centerName);
  }, [callNextTicket, centerName]);

  return {
    tickets: filteredTickets,
    allTickets: tickets,
    loading,
    error,
    addTicket: addTicketForCenter,
    callNextTicket: callNextTicketForCenter,
    holdTicket,
    completeTicket,
    refreshQueue
  };
};
