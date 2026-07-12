import express from 'express';
import { uploadDocument, listDocuments } from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, authorize('citizen', 'admin'), uploadDocument)
  .get(protect, authorize('citizen', 'admin'), listDocuments);

export default router;
