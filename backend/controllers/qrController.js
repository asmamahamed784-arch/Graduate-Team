import { QRService } from '../services/qrService.js';

// @desc    Generate QR code image server-side
// @route   GET /api/qr/generate
// @access  Public
export const generateQR = async (req, res) => {
  try {
    const data = await QRService.generateQR(req.query.text);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message, data: error.data });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify QR scan and register logs
// @route   POST /api/qr/verify
// @access  Private/Operator or Admin
export const verifyQR = async (req, res) => {
  try {
    const ticketRefRaw = req.body.ticketRef || req.body.reference || req.body.code || '';
    const result = await QRService.verifyQR({ 
      ticketRefRaw, 
      user: req.user, 
      ipAddress: req.ip 
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message, data: error.data });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply an operator/admin QR verification action
// @route   POST /api/qr/action
// @access  Private/Operator or Admin
export const handleQRAction = async (req, res) => {
  try {
    const ticketRefRaw = req.body.ticketRef || req.body.reference || '';
    const actionRaw = req.body.action || '';
    
    const result = await QRService.handleQRAction({
      ticketRefRaw,
      actionRaw,
      user: req.user,
      ipAddress: req.ip,
      io: req.app.get('io')
    });
    
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message, data: error.data });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
