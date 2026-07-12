import express from 'express';
import { listActivityLogs, verifyQRScan } from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), listActivityLogs);
router.post('/scan', protect, authorize('operator', 'admin'), verifyQRScan);

export default router;
