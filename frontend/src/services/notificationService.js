import { apiClient } from '../api/apiClient';

export const notificationService = {
  getNotifications: async () => {
    const res = await apiClient.get('/api/notifications/list');
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await apiClient.put(`/api/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async () => {
    const res = await apiClient.put('/api/notifications/read-all');
    return res.data;
  },

  deleteNotification: async (id) => {
    const res = await apiClient.delete(`/api/notifications/${id}`);
    return res.data;
  },

  triggerNotification: async (title, desc, category = 'System') => {
    const res = await apiClient.post('/api/notifications', { title, desc, category });
    return res.data;
  }
};

export default notificationService;
