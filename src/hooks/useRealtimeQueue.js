import { useState, useCallback } from 'react';
import { useQueue } from './useQueue';

/**
 * Custom hook connecting views to real-time queue state from QueueContext.
 * Interoperates with the Express Socket.io channel and shared queue actions.
 */
export const useRealtimeQueue = (centerName = 'Banaadir National ID Center') => {
  const { tickets, loading, error, refreshQueue, addTicket, callNextTicket, holdTicket, completeTicket } = useQueue(centerName);
  const [isLive, setIsLive] = useState(true);

  const connectWebSocket = useCallback(() => {
    setIsLive(true);
  }, []);

  const disconnectWebSocket = useCallback(() => {
    setIsLive(false);
  }, []);

  return {
    tickets,
    loading,
    error,
    isLive,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    addTicket,
    callNextTicket,
    holdTicket,
    completeTicket,
    refreshQueue
  };
};
