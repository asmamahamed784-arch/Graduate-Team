const QueueTicket = require('../models/QueueTicket');
const QRCode = require('qrcode');

// Helper to generate next ticket number
const generateTicketNumber = async (serviceCenterId, serviceId) => {
  // In a real app, you'd reset this daily and format it nicely, e.g., A-001, B-001
  const count = await QueueTicket.countDocuments({ serviceCenter: serviceCenterId, service: serviceId });
  return `TKT-${count + 1}`;
};

// @desc    Generate a queue ticket
// @route   POST /api/queue/generate
// @access  Public (or Private depending on flow)
exports.generateTicket = async (req, res) => {
  try {
    const { serviceId, serviceCenterId, appointmentId, userId } = req.body;

    const ticketNumber = await generateTicketNumber(serviceCenterId, serviceId);

    const ticket = await QueueTicket.create({
      user: userId || null,
      service: serviceId,
      serviceCenter: serviceCenterId,
      appointment: appointmentId || null,
      ticketNumber
    });

    const qrData = JSON.stringify({
      ticketId: ticket._id,
      ticketNumber,
      type: 'QUEUE_TICKET'
    });

    const qrCodeImage = await QRCode.toDataURL(qrData);
    ticket.qrCode = qrCodeImage;
    await ticket.save();

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current queue status for a center
// @route   GET /api/queue/:serviceCenterId
// @access  Public
exports.getQueueStatus = async (req, res) => {
  try {
    const { serviceCenterId } = req.params;
    const tickets = await QueueTicket.find({ 
      serviceCenter: serviceCenterId,
      status: { $in: ['waiting', 'serving'] }
    }).sort({ issuedAt: 1 }).populate('service', 'name');

    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Call next ticket or update status
// @route   PUT /api/queue/:id/status
// @access  Private/Admin
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'serving', 'served', 'skipped'
    
    let ticket = await QueueTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    ticket.status = status;
    if (status === 'served') {
      ticket.servedAt = Date.now();
      ticket.servedBy = req.user.id;
    }

    await ticket.save();

    // Here you would typically emit a WebSocket event for real-time updates
    // req.io.emit('queueUpdate', { ticket });

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
