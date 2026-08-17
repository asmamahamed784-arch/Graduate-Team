import { SmsService } from '../services/smsService.js';

export const listSmsLogs = async (req, res) => {
  try {
    const data = await SmsService.listSmsLogs(req.query);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendFailedSms = async (req, res) => {
  try {
    const data = await SmsService.resendFailedSms({
      id: req.params.id,
      user: req.user,
      ipAddress: req.ip
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
