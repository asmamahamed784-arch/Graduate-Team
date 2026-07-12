import express from 'express';
import { listContactMessages, submitContactMessage } from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .post(submitContactMessage)
  .get(protect, authorize('admin'), listContactMessages);

export default router;
