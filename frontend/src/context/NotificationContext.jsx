// src/context/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { resolveNotificationRoute } from '../utils/notificationRouting';
import { getNotificationDisplayMessage } from '../utils/cancellationDisplay';
import {
  isAcknowledgmentNotification,
  NQS_FEEDBACK_TOAST_ID,
} from '../utils/feedbackToast';

export const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
  deleteNotification: () => {},
  addNotification: () => {},
  sendNotification: async () => {},
  openNotification: async () => {}
});

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userId = user?._id || user?.id;
  const userRole = String(user?.role || '').toLowerCase();
  const userRef = useRef(user);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const belongsToCurrentUser = useCallback((notification = {}) => {
    if (!userId) return true;

    const owner =
      notification.user?._id ||
      notification.user?.id ||
      notification.user ||
      notification.userId ||
      notification.recipient?._id ||
      notification.recipient?.id ||
      notification.recipient ||
      notification.recipientId ||
      notification.citizen?._id ||
      notification.citizen?.id ||
      notification.citizen ||
      notification.citizenId;

    if (!owner) {
      return userRole === 'admin';
    }
    return owner.toString() === userId.toString();
  }, [userId, userRole]);

  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    try {
      const res = await apiClient.get('/api/notifications/list');
      const payload = res.data?.data ?? res.data;
      const items = Array.isArray(payload) ? payload : [];
      setNotifications(items.filter(belongsToCurrentUser));
    } catch {
      setNotifications([]);
    }
  }, [belongsToCurrentUser, isAuthenticated]);

  const openNotification = useCallback(async (notification = {}) => {
    const id = notification._id || notification.id;
    if (id && !notification.read && isAuthenticated) {
      try {
        await apiClient.put(`/api/notifications/${id}/read`);
        await syncNotifications();
      } catch {
        // Still open the related page even if read update fails.
      }
    }

    const route = await resolveNotificationRoute(notification, userRef.current || user);
    if (route) {
      navigateRef.current(route);
      return route;
    }
    navigateRef.current('/notifications');
    return '/notifications';
  }, [isAuthenticated, syncNotifications, user]);

  useEffect(() => {
    if (!authLoading) {
      syncNotifications();
    }
  }, [authLoading, syncNotifications]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return undefined;
    }

    const socket = io(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || undefined);
    socketRef.current = socket;

    const mergeNotification = (notification) => {
      if (!notification) return;
      if (!belongsToCurrentUser(notification)) return;
      setNotifications((current) => {
        const notificationId = notification._id || notification.id;
        if (notificationId && current.some((item) => (item._id || item.id) === notificationId)) {
          return current;
        }
        return [notification, ...current];
      });

      // Keep inbox updated, but do not show a second toast for the same
      // submit/verify action the page already confirmed.
      if (isAcknowledgmentNotification(notification)) return;

      const title = notification.title || 'New notification';
      const preview = String(getNotificationDisplayMessage(notification)).trim();

      toast.info(
        <div className="pr-1">
          <p className="text-sm font-bold">{title}</p>
          {preview ? <p className="mt-0.5 line-clamp-2 text-xs opacity-90">{preview}</p> : null}
          <p className="mt-1 text-[11px] font-semibold underline underline-offset-2">Click to open</p>
        </div>,
        {
          toastId: NQS_FEEDBACK_TOAST_ID,
          autoClose: 8000,
          closeOnClick: true,
          onClick: () => {
            openNotification(notification);
          }
        }
      );
    };

    if (userId) {
      socket.on(`notification-${userId}`, mergeNotification);
    }

    const poll = window.setInterval(syncNotifications, 15000);

    return () => {
      window.clearInterval(poll);
      if (userId) {
        socket.off(`notification-${userId}`, mergeNotification);
      }
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [authLoading, belongsToCurrentUser, isAuthenticated, openNotification, syncNotifications, userId]);

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

  const addNotification = (title, desc, category = 'System') => {
    const newItem = {
      id: Date.now(),
      title,
      desc,
      timestamp: 'Just now',
      category,
      read: false
    };
    setNotifications((prev) => [newItem, ...prev]);
    if (isAcknowledgmentNotification(newItem)) return;

    toast.info(
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-[11px] font-semibold underline underline-offset-2">Click to open</p>
      </div>,
      {
        toastId: NQS_FEEDBACK_TOAST_ID,
        autoClose: 8000,
        closeOnClick: true,
        onClick: () => openNotification(newItem)
      }
    );
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
      sendNotification,
      openNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
