import express from 'express';
import { getOperatorDashboardStats, getOperatorQueue } from '../controllers/reportController.js';
import { callNextTicket, completeTicket } from '../controllers/queueController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('operator', 'super_operator', 'admin'), getOperatorDashboardStats);
router.get('/queue', protect, authorize('operator', 'super_operator', 'admin'), getOperatorQueue);
router.post('/call-next', protect, authorize('operator', 'super_operator', 'admin'), callNextTicket);
router.post('/complete/:ticketId', protect, authorize('operator', 'super_operator', 'admin'), async (req, res) => {
  req.params.id = req.params.ticketId;
  return completeTicket(req, res);
});

export default router;
