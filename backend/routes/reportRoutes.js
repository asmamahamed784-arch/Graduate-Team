import express from 'express';
import { getDashboardStats, getOperatorDashboardStats, getReportsAndAnalytics } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/operator-dashboard', protect, authorize('operator', 'super_operator', 'admin'), getOperatorDashboardStats);
router.get('/analytics', protect, authorize('admin'), getReportsAndAnalytics);

export default router;
