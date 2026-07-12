import AuditLog from '../models/AuditLog.js';

// @desc    Get all audit logs (with pagination and filters)
// @route   GET /api/audits
// @access  Private/Admin
export const getAuditLogs = async (req, res) => {
  try {
    const { action, role, page = 1, limit = 10 } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }
    if (role) {
      query.role = role;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    return res.json({
      success: true,
      count: logs.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: logs
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
