import express from 'express';
import {
  listCenters,
  getCenterById,
  getAssignedCenter,
  createCenter,
  updateCenter,
  deleteCenter
} from '../controllers/centerController.js';
import { optionalProtect, protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .get(optionalProtect, listCenters)
  .post(protect, authorize('admin'), createCenter);

router.get('/list', optionalProtect, listCenters);
router.get('/assigned/me', protect, authorize('operator', 'super_operator', 'center_manager', 'citizen', 'admin'), getAssignedCenter);

router.route('/:id')
  .get(optionalProtect, getCenterById)
  .put(protect, authorize('admin'), updateCenter)
  .delete(protect, authorize('admin'), deleteCenter);

export default router;
