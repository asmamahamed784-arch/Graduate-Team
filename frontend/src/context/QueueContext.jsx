// src/context/QueueContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiClient } from '../api/apiClient';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

export const QueueContext = createContext({
  tickets: [],
  loading: false,
  error: null,
  addTicket: async () => {},
  callNextTicket: async () => {},
  holdTicket: async () => {},
  completeTicket: async () => {},
  refreshQueue: async () => {}
});

const nameFrom = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || value.title || fallback;
};

const idFrom = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id || value.id;
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  serviceId: idFrom(ticket.service) || ticket.serviceId,
  centerId: idFrom(ticket.center) || ticket.centerId,
  serviceDetails: typeof ticket.service === 'object' ? ticket.service : ticket.serviceDetails,
  centerDetails: typeof ticket.center === 'object' ? ticket.center : ticket.centerDetails,
  service: nameFrom(ticket.service, ticket.serviceName || 'National ID Registration'),
  center: nameFrom(ticket.center, ticket.centerName || 'Banaadir National ID Center'),
  citizenName: ticket.citizenName || ticket.name || 'Citizen',
  name: ticket.ref || ticket._id || ticket.id || 'Ticket',
  waitTime: ticket.waitTime || ticket.estimatedWait || '0 min',
  wait: Number.parseInt(ticket.waitTime || ticket.estimatedWait || '0', 10) || 0
});

export const QueueProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const { isAuthenticated, role, loading: authLoading } = useAuth();

  const refreshQueue = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = role === 'operator' || role === 'super_operator'
        ? '/api/operator/queue'
        : '/api/queue/list';
      const res = await apiClient.get(endpoint);
      setTickets((res.data || []).map(normalizeTicket));
    } catch (e) {
      setError(e.message || 'Failed to fetch queue list');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setTickets([]);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    refreshQueue();

    // Connect to NQS Express Socket.io server
    const socket = io(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || undefined);
    socketRef.current = socket;

    socket.on('connect', () => {});

    // Real-time listener: triggers queue update
    socket.on('queueUpdate', () => {
      refreshQueue();
    });

    socket.on('voiceCallNext', () => {});

    return () => {
      if (socket) socket.disconnect();
    };
  }, [authLoading, isAuthenticated, refreshQueue]);

  const addTicket = async (serviceName, citizenName = 'Citizen', centerName = 'Banaadir National ID Center') => {
    if (!isAuthenticated) {
      toast.error('Please sign in before creating queue tickets.');
      return undefined;
    }

    setLoading(true);
    try {
      // Fetch services and centers to resolve IDs
      const servicesRes = await apiClient.get('/api/services/list');
      const serviceObj = (servicesRes.data || []).find(s => s.name === serviceName);
      if (!serviceObj) throw new Error('Selected service not found');

      const centersRes = await apiClient.get('/api/centers/list');
      const centerObj = (centersRes.data || []).find(c => c.name === centerName);
      if (!centerObj) throw new Error('Selected center not found');

      const payload = role === 'citizen'
        ? {
            serviceId: serviceObj._id || serviceObj.id,
            centerId: centerObj._id || centerObj.id,
            date: new Date().toISOString().slice(0, 10)
          }
        : {
            serviceId: serviceObj._id || serviceObj.id,
            centerId: centerObj._id || centerObj.id,
            citizenName
          };

      const res = await api.post(role === 'citizen' ? '/api/bookings' : '/api/queue/generate', payload);

      if (res.data.success) {
        toast.success(`Ticket ${res.data.data.ref} created.`);
        await refreshQueue();
        return normalizeTicket(res.data.data);
      }
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to create queue ticket';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const callNextTicket = useCallback(async (counter = '01', centerName = 'Banaadir National ID Center') => {
    if (!isAuthenticated) {
      toast.error('Please sign in before managing the queue.');
      return;
    }

    setLoading(true);
    try {
      const isOperatorRole = role === 'operator' || role === 'super_operator';
      const endpoint = isOperatorRole ? '/api/operator/call-next' : '/api/queue/call-next';
      const payload = { counter: `Counter ${counter}` };

      if (!isOperatorRole) {
        const centersRes = await apiClient.get('/api/centers/list');
        const centerObj = (centersRes.data || []).find(c => c.name === centerName);
        if (!centerObj) throw new Error('Center not found');
        payload.centerId = centerObj._id || centerObj.id;
      }

      const res = await api.post(endpoint, payload);
      if (res.data.success) {
        toast.success(`Calling ticket ${res.data.data.ref} to Counter ${counter}.`);
      }
      await refreshQueue();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to call next ticket';
      toast.info(errMsg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, refreshQueue, role]);

  const holdTicket = useCallback(async (ticketRef) => {
    if (!isAuthenticated) {
      toast.error('Please sign in before managing the queue.');
      return;
    }

    setLoading(true);
    try {
      const ticketObj = tickets.find(t => t.ref === ticketRef);
      if (!ticketObj) throw new Error('Ticket not found');

      const id = ticketObj._id || ticketObj.id;
      const res = await api.put(`/api/queue/${id}/hold`);
      
      if (res.data.success) {
        toast.warning(`Ticket ${ticketRef} placed on hold.`);
      }
      await refreshQueue();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to place ticket on hold';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tickets, refreshQueue]);

  const completeTicket = useCallback(async (ticketRef) => {
    if (!isAuthenticated) {
      toast.error('Please sign in before managing the queue.');
      return;
    }

    setLoading(true);
    try {
      const ticketObj = tickets.find(t => t.ref === ticketRef);
      if (!ticketObj) throw new Error('Ticket not found');

      const id = ticketObj._id || ticketObj.id;
      const res = await api.put(`/api/queue/${id}/complete`);

      if (res.data.success) {
        toast.success(`Ticket ${ticketRef} marked as completed.`);
      }
      await refreshQueue();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to complete ticket';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tickets, refreshQueue]);

  return (
    <QueueContext.Provider value={{
      tickets,
      loading,
      error,
      addTicket,
      callNextTicket,
      holdTicket,
      completeTicket,
      refreshQueue
    }}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueueContext = () => useContext(QueueContext);
export default QueueContext;
