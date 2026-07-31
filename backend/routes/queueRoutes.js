import express from 'express';
import {
  generateWalkInTicket,
  callNextTicket,
  holdTicket,
  completeTicket,
  getLiveQueue,
  trackTicket,
  listTickets
} from '../controllers/queueController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/list', protect, listTickets);
router.post('/generate', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), generateWalkInTicket);
router.post('/call-next', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), callNextTicket);
router.put('/:id/hold', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), holdTicket);
router.put('/:id/complete', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), completeTicket);

router.get('/live/:centerId', getLiveQueue);
router.get('/track/:ref', protect, authorize('citizen', 'operator', 'super_operator', 'center_manager', 'admin'), trackTicket);

export default router;
