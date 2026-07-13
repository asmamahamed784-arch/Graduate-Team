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

// Alias kept for frontend callers that use /api/services/list.
// Must be registered before /:id so "list" is not treated as an ObjectId.
router.get('/list', listServices);

router.route('/:id')
  .get(getServiceById)
  .put(protect, authorize('admin'), updateService)
  .delete(protect, authorize('admin'), deleteService);

export default router;
