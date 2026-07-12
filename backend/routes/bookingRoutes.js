import express from 'express';
import {
  createBooking,
  getBookingAvailability,
  getUserBookings,
  getAllBookings,
  getBookingDetails,
  cancelBooking,
  resubmitBooking,
  updateBookingStatus,
  updateRequestStatus
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, authorize('citizen', 'admin'), createBooking);

router.route('/my')
  .get(protect, authorize('citizen', 'admin'), getUserBookings);

router.route('/availability')
  .get(protect, authorize('citizen', 'admin'), getBookingAvailability);

router.route('/admin/all')
  .get(protect, authorize('admin', 'super_operator'), getAllBookings);

router.route('/admin/:id/status')
  .put(protect, authorize('admin', 'super_operator'), updateBookingStatus);

router.route('/admin/:id/request-status')
  .put(protect, authorize('admin', 'super_operator'), updateRequestStatus);

router.route('/admin/:id/replacement-status')
  .put(protect, authorize('admin', 'super_operator'), updateRequestStatus);

router.route('/:id/cancel')
  .put(protect, authorize('citizen', 'admin'), cancelBooking);

router.route('/:id/resubmit')
  .put(protect, authorize('citizen'), resubmitBooking);

router.route('/:refOrId')
  .get(protect, authorize('citizen', 'operator', 'admin'), getBookingDetails);

export default router;
