import express from 'express';
import {
  createAdminUser,
  deleteAdminUser,
  getUserDetails,
  listUsers,
  resetUserPassword,
  updateUserStatus
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'user_manager'));

router.route('/')
  .get(listUsers);

router.route('/admins')
  .post(authorize('admin'), createAdminUser);

router.route('/:id')
  .get(getUserDetails)
  .delete(authorize('admin'), deleteAdminUser);

router.route('/:id/status')
  .put(updateUserStatus);

router.route('/:id/reset-password')
  .put(resetUserPassword);

export default router;
