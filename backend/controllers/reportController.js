import { ReportService } from '../services/reportService.js';

// @desc    Get dashboard metrics and stats
// @route   GET /api/reports/stats
// @access  Private/Operator or Admin
export const getDashboardStats = async (req, res) => {
  try {
    const data = await ReportService.getDashboardStats();
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get operator dashboard metrics for the assigned center
// @route   GET /api/reports/operator-dashboard
// @access  Private/Operator or Admin
export const getOperatorDashboardStats = async (req, res) => {
  try {
    const data = await ReportService.getOperatorDashboardStats({
      user: req.user,
      query: req.query
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get operator queue tickets for the assigned center
// @route   GET /api/operator/queue
// @access  Private/Operator or Admin
export const getOperatorQueue = async (req, res) => {
  try {
    const data = await ReportService.getOperatorQueue({
      user: req.user
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed charts and analytics reports
// @route   GET /api/reports/analytics
// @access  Private/Admin
export const getReportsAndAnalytics = async (req, res) => {
  try {
    const data = await ReportService.getReportsAndAnalytics();
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Public Home page impact stats (counts only, no PII)
// @route   GET /api/reports/public-home-stats
// @access  Public
export const getPublicHomeStats = async (_req, res) => {
  try {
    const data = await ReportService.getPublicHomeStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
