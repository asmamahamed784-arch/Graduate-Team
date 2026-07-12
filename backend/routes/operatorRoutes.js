import express from 'express';
import {
  createOperator,
  listOperators,
  resetOperatorPassword,
  updateOperator
} from '../controllers/operatorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'super_operator'), listOperators)
  .post(authorize('admin', 'super_operator'), createOperator);

router.route('/:id')
  .put(authorize('admin', 'super_operator'), updateOperator);

router.route('/:id/reset-password')
  .put(authorize('admin', 'super_operator'), resetOperatorPassword);

export default router;
