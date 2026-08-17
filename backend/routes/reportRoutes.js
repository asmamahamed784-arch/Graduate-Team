import express from 'express';
import {
  getDashboardStats,
  getOperatorDashboardStats,
  getPublicHomeStats,
  getReportsAndAnalytics
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/public-home-stats', getPublicHomeStats);
router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/operator-dashboard', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), getOperatorDashboardStats);
router.get('/analytics', protect, authorize('admin'), getReportsAndAnalytics);

export default router;
