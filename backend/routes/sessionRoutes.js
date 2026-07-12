import express from 'express';
import { invalidateSession, listActiveSessions } from '../controllers/sessionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), listActiveSessions);
router.put('/:id/invalidate', protect, authorize('admin'), invalidateSession);

export default router;
