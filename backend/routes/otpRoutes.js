import express from 'express';
import {
  requestForgotPasswordOtp,
  requestOtpCode,
  resetForgotPassword,
  verifyForgotPasswordOtp,
  verifyOtpCode
} from '../controllers/otpController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/request', protect, authorize('citizen', 'operator', 'super_operator', 'center_manager', 'admin'), requestOtpCode);
router.post('/verify', protect, authorize('citizen', 'operator', 'super_operator', 'center_manager', 'admin'), verifyOtpCode);

router.post('/forgot-password/request', requestForgotPasswordOtp);
router.post('/forgot-password/verify', verifyForgotPasswordOtp);
router.post('/forgot-password/reset', resetForgotPassword);

export default router;
