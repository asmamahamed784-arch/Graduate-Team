import express from 'express';
import {
  registerUser,
  loginUser,
  resendLoginOtp,
  verifyLoginOtp,
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
router.post('/login/otp/verify', verifyLoginOtp);
router.post('/login/otp/resend', resendLoginOtp);
router.post('/logout', protect, logoutUser);
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, authorize('citizen', 'operator', 'super_operator', 'center_manager', 'admin'), updateUserProfile)
  .delete(protect, authorize('citizen', 'admin'), deleteUserAccount);
router.put('/password', protect, authorize('citizen', 'operator', 'super_operator', 'center_manager', 'admin'), changePassword);

export default router;
