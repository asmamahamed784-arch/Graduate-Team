import express from 'express';
import { generateQR, handleQRAction, verifyQR } from '../controllers/qrController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/generate', generateQR);
router.post('/verify', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), verifyQR);
router.post('/action', protect, authorize('operator', 'super_operator', 'center_manager', 'admin'), handleQRAction);

export default router;
