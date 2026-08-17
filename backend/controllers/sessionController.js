import { SessionService } from '../services/sessionService.js';

export const listActiveSessions = async (req, res) => {
  try {
    const result = await SessionService.listActiveSessions();
    return res.json({ success: true, count: result.count, stats: result.stats, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const invalidateSession = async (req, res) => {
  try {
    const data = await SessionService.invalidateSession(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
