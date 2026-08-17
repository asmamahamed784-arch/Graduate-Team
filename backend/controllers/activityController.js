import { ActivityService } from '../services/activityService.js';

// @desc    Get UI activity logs
// @route   GET /api/activities
// @access  Private/Admin
export const listActivityLogs = async (req, res) => {
  try {
    const data = await ActivityService.listActivityLogs();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Verify QR scan and register logs
// @route   POST /api/queue/scan
// @access  Private/Operator or Admin
export const verifyQRScan = async (req, res) => {
  try {
    const { ticketRef } = req.body;
    const result = await ActivityService.verifyQRScan({
      ticketRef,
      user: req.user,
      ipAddress: req.ip
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message,
        data: result.data
      });
    }

    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

