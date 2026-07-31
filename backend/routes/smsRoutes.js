import express from 'express';
import { listSmsLogs, resendFailedSms } from '../controllers/smsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/logs', listSmsLogs);
router.put('/logs/:id/resend', resendFailedSms);

export default router;
