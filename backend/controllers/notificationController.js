import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNationalIdEmail } from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { user: req.user._id },
        { user: null } // System broadcast notifications
      ]
    }).sort({ timestamp: -1 });

    return res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a system notification and delivery logs
// @route   POST /api/notifications
// @access  Private/Admin or Operator
export const sendNotification = async (req, res) => {
  try {
    const { title, desc, category = 'System', userId = null, sendEmail = true, sendSms = true } = req.body;

    if (!title || !desc) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const notification = await Notification.create({
      user: userId || null,
      title,
      desc,
      category
    });

    const recipients = userId
      ? await User.find({ _id: userId })
      : await User.find({ role: { $in: ['citizen', 'user'] } });

    if (sendEmail) {
      await Promise.all(recipients.map((user) => sendNationalIdEmail({
        to: user.email,
        subject: title,
        template: {
          heading: title,
          intro: desc,
          rows: [
            ['Citizen name', user.name],
            ['Category', category]
          ]
        }
      })));
    }

    if (sendSms) {
      await Promise.all(recipients.map((user) => logSmsOnly({
        recipient: user.phone,
        message: desc
      })));
    }

    const io = req.app.get('io');
    if (io) {
      if (userId) {
        io.emit(`notification-${userId}`, notification);
      } else {
        io.emit('notification-broadcast', notification);
      }
    }

    return res.status(201).json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Verify ownership (or allow system broadcast to be read locally/marked read by citizens, but here we just check if it's personal)
    if (notification.user && notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this notification' });
    }

    notification.read = true;
    await notification.save();

    return res.json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        read: false,
        $or: [
          { user: req.user._id },
          { user: null }
        ]
      },
      { read: true }
    );

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dismiss/Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const dismissNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.user && notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
