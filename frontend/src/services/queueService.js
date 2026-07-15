// src/services/queueService.js
import { apiClient } from '../api/apiClient';

export const queueService = {
  /**
   * Fetches active queue list
   */
  getQueueList: async () => {
    const res = await apiClient.get('/api/queue/list');
    return res.data;
  },

  /**
   * Books a new appointment slot and returns the ticket
   */
  createTicket: async (serviceId, centerId, date, timeSlot) => {
    const res = await apiClient.post('/api/bookings', { serviceId, centerId, date, timeSlot });
    return res.data;
  },

  /**
   * Tracks the real-time status of a specific reference code
   */
  trackQueueStatus: async (reference) => {
    const res = await apiClient.get(`/api/queue/track/${reference}`);
    return res.data;
  }
};

export default queueService;
