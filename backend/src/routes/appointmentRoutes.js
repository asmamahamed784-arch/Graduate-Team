const express = require('express');
const {
  bookAppointment,
  getMyAppointments,
  getAllAppointments,
  updateAppointmentStatus
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.route('/')
  .post(protect, bookAppointment)
  .get(protect, authorize('superadmin', 'manager', 'staff'), getAllAppointments);

router.get('/my', protect, getMyAppointments);

router.put('/:id/status', protect, authorize('superadmin', 'manager', 'staff'), updateAppointmentStatus);

module.exports = router;
