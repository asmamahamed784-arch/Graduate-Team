import ActivityLog from '../models/ActivityLog.js';
import QRScan from '../models/QRScan.js';
import Ticket from '../models/Ticket.js';

// @desc    Get UI activity logs
// @route   GET /api/activities
// @access  Private/Admin
export const listActivityLogs = async (req, res) => {
  try {
    const list = await ActivityLog.find({})
      .populate('user', 'name role')
      .sort({ timestamp: -1 })
      .limit(100);

    return res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify QR scan and register logs
// @route   POST /api/queue/scan
// @access  Private/Operator or Admin
export const verifyQRScan = async (req, res) => {
  try {
    const { ticketRef } = req.body;

    const ticket = await Ticket.findOne({ ref: ticketRef }).populate('service center');

    let status = 'Invalid';
    if (ticket) {
      if (ticket.status === 'Cancelled') {
        status = 'Expired';
      } else {
        status = 'Valid';
      }
    }

    const scan = await QRScan.create({
      ticketRef,
      scannedBy: req.user._id,
      status,
      ipAddress: req.ip || '127.0.0.1'
    });

    if (status === 'Valid') {
      return res.json({
        success: true,
        message: 'Ticket checked.',
        data: {
          scanId: scan._id,
          ticketRef: ticket.ref,
          service: ticket.service.name,
          center: ticket.center.name,
          status: ticket.status
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Ticket check returned status: ${status}`,
        data: { scanId: scan._id, status }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
