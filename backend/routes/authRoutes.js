import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  logoutUser,
  deleteUserAccount
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, authorize('citizen', 'operator', 'super_operator', 'admin'), updateUserProfile)
  .delete(protect, authorize('citizen', 'admin'), deleteUserAccount);
router.put('/password', protect, authorize('citizen', 'operator', 'super_operator', 'admin'), changePassword);

export default router;
