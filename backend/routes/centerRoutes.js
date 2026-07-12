import express from 'express';
import {
  listCenters,
  getCenterById,
  createCenter,
  updateCenter,
  deleteCenter
} from '../controllers/centerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(listCenters)
  .post(protect, authorize('admin'), createCenter);

router.route('/:id')
  .get(getCenterById)
  .put(protect, authorize('admin'), updateCenter)
  .delete(protect, authorize('admin'), deleteCenter);

export default router;
