import { AuditService } from '../services/auditService.js';

// @desc    Get all audit logs (with pagination and filters)
// @route   GET /api/audits
// @access  Private/Admin
export const getAuditLogs = async (req, res) => {
  try {
    const result = await AuditService.getAuditLogs(req.query);
    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

