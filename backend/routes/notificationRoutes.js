import express from 'express';
import {
  getUserNotifications,
  sendNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect); // All notification endpoints are protected

router.route('/')
  .get(authorize('citizen', 'operator', 'super_operator', 'admin'), getUserNotifications)
  .post(authorize('admin'), sendNotification);

// Alias kept for frontend callers that use /api/notifications/list.
router.get('/list', authorize('citizen', 'operator', 'super_operator', 'admin'), getUserNotifications);

router.route('/read-all')
  .put(authorize('citizen', 'operator', 'super_operator', 'admin'), markAllNotificationsAsRead);

router.route('/:id/read')
  .put(authorize('citizen', 'operator', 'super_operator', 'admin'), markNotificationAsRead);

router.route('/:id')
  .delete(authorize('citizen', 'operator', 'super_operator', 'admin'), dismissNotification);

export default router;
