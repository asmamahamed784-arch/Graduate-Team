import express from 'express';
import {
  activateOperator,
  approveOperator,
  createOperator,
  deactivateOperator,
  deleteOperator,
  getOperatorDetails,
  getOperatorCenterStats,
  listOperators,
  rejectOperator,
  resetOperatorPassword,
  updateOperator
} from '../controllers/operatorController.js';
import { getOperatorDashboardStats } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/center-stats', authorize('admin'), getOperatorCenterStats);
router.get('/dashboard', authorize('operator', 'super_operator', 'center_manager', 'admin'), getOperatorDashboardStats);

router.route('/')
  .get(authorize('admin', 'super_operator', 'center_manager'), listOperators)
  .post(authorize('admin', 'super_operator', 'center_manager'), createOperator);

router.route('/:id')
  .get(authorize('admin', 'super_operator', 'center_manager'), getOperatorDetails)
  .put(authorize('admin', 'super_operator', 'center_manager'), updateOperator);

router.put('/:id/approve', authorize('admin'), approveOperator);
router.put('/:id/reject', authorize('admin'), rejectOperator);
router.put('/:id/activate', authorize('admin'), activateOperator);
router.put('/:id/deactivate', authorize('admin'), deactivateOperator);

router.route('/:id/reset-password')
  .put(authorize('admin', 'super_operator', 'center_manager'), resetOperatorPassword);

router.route('/:id')
  .delete(authorize('admin'), deleteOperator);

export default router;
