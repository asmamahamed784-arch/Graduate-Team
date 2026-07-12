import express from 'express';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(listAnnouncements)
  .post(protect, authorize('admin'), createAnnouncement);

router.route('/:id')
  .put(protect, authorize('admin'), updateAnnouncement)
  .delete(protect, authorize('admin'), deleteAnnouncement);

export default router;
