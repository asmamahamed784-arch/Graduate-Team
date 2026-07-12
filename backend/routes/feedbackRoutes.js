import express from 'express';
import { submitFeedback, listFeedback } from '../controllers/feedbackController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, authorize('citizen'), submitFeedback)
  .get(protect, authorize('admin'), listFeedback);

export default router;
