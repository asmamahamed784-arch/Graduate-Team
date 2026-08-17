import { SettingService } from '../services/settingService.js';

// @desc    Get current user settings
// @route   GET /api/settings
// @access  Private
export const getUserSettings = async (req, res) => {
  try {
    const data = await SettingService.getUserSettings(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user settings
// @route   PUT /api/settings
// @access  Private
export const updateUserSettings = async (req, res) => {
  try {
    const data = await SettingService.updateUserSettings(req.user.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get system configurations
// @route   GET /api/settings/config
// @access  Public
export const getSystemConfigs = async (req, res) => {
  try {
    const data = await SettingService.getSystemConfigs();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update system configuration
// @route   PUT /api/settings/config/:key
// @access  Private/Admin
export const updateSystemConfig = async (req, res) => {
  try {
    const data = await SettingService.updateSystemConfig(req.params.key, req.body.value);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get appointment schedule controls
// @route   GET /api/settings/schedule
// @access  Private/Admin
export const getAppointmentSchedule = async (_req, res) => {
  try {
    const data = await SettingService.getAppointmentSchedule();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update appointment schedule controls
// @route   PUT /api/settings/schedule
// @access  Private/Admin
export const updateAppointmentSchedule = async (req, res) => {
  try {
    const data = await SettingService.updateAppointmentSchedule(req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
