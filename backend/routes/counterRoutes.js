import express from 'express';
import {
  listCounters,
  createCounter,
  updateCounter,
  deleteCounter
} from '../controllers/counterController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, authorize('operator', 'admin'), listCounters)
  .post(protect, authorize('admin'), createCounter);

router.route('/:id')
  .put(protect, authorize('operator', 'admin'), updateCounter)
  .delete(protect, authorize('admin'), deleteCounter);

export default router;
