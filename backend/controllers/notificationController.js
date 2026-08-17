import { NotificationService } from '../services/notificationService.js';

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req, res) => {
  try {
    const data = await NotificationService.getUserNotifications({
      user: req.user
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a system notification and delivery logs
// @route   POST /api/notifications
// @access  Private/Admin or Operator
export const sendNotification = async (req, res) => {
  try {
    const { notificationsCount, notification } = await NotificationService.sendNotification({
      body: req.body,
      io: req.app.get('io')
    });
    return res.status(201).json({ success: true, count: notificationsCount, data: notification });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req, res) => {
  try {
    const data = await NotificationService.markNotificationAsRead({
      id: req.params.id,
      user: req.user
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const data = await NotificationService.markAllNotificationsAsRead({
      user: req.user
    });
    return res.json({ success: true, message: data.message });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dismiss/Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const dismissNotification = async (req, res) => {
  try {
    const data = await NotificationService.dismissNotification({
      id: req.params.id,
      user: req.user
    });
    return res.json({ success: true, message: data.message });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
