import express from 'express';
import { generateQR, handleQRAction, verifyQR } from '../controllers/qrController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/generate', generateQR);
router.post('/verify', protect, authorize('operator', 'admin'), verifyQR);
router.post('/action', protect, authorize('operator', 'admin'), handleQRAction);

export default router;
