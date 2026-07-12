import ActiveSession from '../models/ActiveSession.js';

export const listActiveSessions = async (req, res) => {
  try {
    const sessions = await ActiveSession.find({})
      .populate('user', 'name username role status')
      .sort({ lastActiveTime: -1 })
      .limit(300);

    return res.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const invalidateSession = async (req, res) => {
  try {
    const session = await ActiveSession.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive', loggedOutAt: new Date(), lastActiveTime: new Date() },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, data: session });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
