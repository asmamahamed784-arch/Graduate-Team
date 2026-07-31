import express from 'express';
import {
  listServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} from '../controllers/serviceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(listServices)
  .post(protect, authorize('admin'), createService);

router.route('/:id')
  .get(getServiceById)
  .put(protect, authorize('admin'), updateService)
  .delete(protect, authorize('admin'), deleteService);

export default router;
