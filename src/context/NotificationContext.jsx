// src/context/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

export const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
  deleteNotification: () => {},
  addNotification: () => {},
  sendNotification: async () => {}
});

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { isAuthenticated, role, loading: authLoading } = useAuth();

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated || role === 'operator') {
      setNotifications([]);
      return;
    }

    try {
      const res = await apiClient.get('/api/notifications/list');
      setNotifications(res.data);
    } catch {
      setNotifications([]);
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (!authLoading) {
      syncNotifications();
    }
  }, [authLoading, syncNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    if (!isAuthenticated) return;

    try {
      await apiClient.put(`/api/notifications/${id}/read`);
      await syncNotifications();
    } catch {
      toast.error('Unable to update this notification.');
    }
  };

  const markAllRead = async () => {
    if (!isAuthenticated) return;

    try {
      await apiClient.put('/api/notifications/read-all');
      await syncNotifications();
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Unable to mark notifications as read.');
    }
  };

  const deleteNotification = async (id) => {
    if (!isAuthenticated) return;

    try {
      await apiClient.delete(`/api/notifications/${id}`);
      await syncNotifications();
    } catch {
      toast.error('Unable to delete this notification.');
    }
  };

  const addNotification = (title, desc, category = "System") => {
    // Local-only alert helper for runtime notifications
    const newItem = {
      id: Date.now(),
      title,
      desc,
      timestamp: "Just now",
      category,
      read: false
    };
    setNotifications(prev => [newItem, ...prev]);
    toast.info(`Notification: ${title}`);
  };

  const sendNotification = async ({ title, desc, category = 'System', sendEmail = true, sendSms = true }) => {
    if (!isAuthenticated) {
      throw new Error('Please sign in to send notifications.');
    }

    const res = await apiClient.post('/api/notifications', {
      title,
      desc,
      category,
      sendEmail,
      sendSms
    });
    await syncNotifications();
    toast.success('Notification sent.');
    return res.data;
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllRead,
      deleteNotification,
      addNotification,
      sendNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
