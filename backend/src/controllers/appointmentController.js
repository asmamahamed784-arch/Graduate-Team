const Appointment = require('../models/Appointment');
const QRCode = require('qrcode');

// @desc    Book an appointment
// @route   POST /api/appointments
// @access  Private
exports.bookAppointment = async (req, res) => {
  try {
    const { serviceId, serviceCenterId, date, timeSlot } = req.body;

    // In real app: validate if slot is available

    const appointment = await Appointment.create({
      user: req.user.id,
      service: serviceId,
      serviceCenter: serviceCenterId,
      date,
      timeSlot
    });

    // Generate QR Code data
    const qrData = JSON.stringify({
      appointmentId: appointment._id,
      userId: req.user.id,
      type: 'APPOINTMENT'
    });

    const qrCodeImage = await QRCode.toDataURL(qrData);
    
    appointment.qrCode = qrCodeImage;
    await appointment.save();

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get logged in user appointments
// @route   GET /api/appointments/my
// @access  Private
exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ user: req.user.id })
      .populate('service', 'name')
      .populate('serviceCenter', 'name location');
      
    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all appointments (for staff/admin)
// @route   GET /api/appointments
// @access  Private/Admin
exports.getAllAppointments = async (req, res) => {
  try {
    let query = {};
    // If staff, only show appointments for their service center
    if (req.user.role === 'staff' && req.user.serviceCenterId) {
      query.serviceCenter = req.user.serviceCenterId;
    }

    const appointments = await Appointment.find(query)
      .populate('user', 'firstName lastName email')
      .populate('service', 'name')
      .populate('serviceCenter', 'name location');
      
    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private/Admin
exports.updateAppointmentStatus = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    appointment.status = req.body.status; // e.g., 'completed', 'no-show'
    await appointment.save();

    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
