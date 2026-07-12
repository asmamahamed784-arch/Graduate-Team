import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import { toast } from 'react-toastify';

/**
 * Custom hook to manage notifications and toast messages.
 * Consumes global NotificationContext and exposes custom styled toast helpers.
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
    addNotification,
    sendNotification
  } = context;

  // Premium Toast notifications with standard themes
  const success = (message, options = {}) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...options
    });
  };

  const error = (message, options = {}) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 4000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...options
    });
  };

  const warning = (message, options = {}) => {
    toast.warning(message, {
      position: "top-right",
      autoClose: 3500,
      hideProgressBar: false,
      closeOnClick: true,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...options
    });
  };

  const info = (message, options = {}) => {
    toast.info(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ...options
    });
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
    addNotification,
    sendNotification,
    toast: {
      success,
      error,
      warning,
      info
    }
  };
};
