import express from 'express';
import {
  getUserSettings,
  updateUserSettings,
  getSystemConfigs,
  updateSystemConfig,
  getAppointmentSchedule,
  updateAppointmentSchedule
} from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin'), getUserSettings)
  .put(protect, authorize('admin'), updateUserSettings);

router.route('/config')
  .get(getSystemConfigs);

router.route('/schedule')
  .get(protect, authorize('admin'), getAppointmentSchedule)
  .put(protect, authorize('admin'), updateAppointmentSchedule);

router.route('/config/:key')
  .put(protect, authorize('admin'), updateSystemConfig);

export default router;
