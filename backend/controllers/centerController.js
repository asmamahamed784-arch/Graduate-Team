import { CenterService } from '../services/centerService.js';

// @desc    Get all centers
// @route   GET /api/centers
// @access  Public
export const listCenters = async (req, res) => {
  try {
    const data = await CenterService.listCenters({
      district: req.query.district,
      user: req.user
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get center by ID
// @route   GET /api/centers/:id
// @access  Public
export const getCenterById = async (req, res) => {
  try {
    const data = await CenterService.getCenterById({
      id: req.params.id,
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

export const getAssignedCenter = async (req, res) => {
  try {
    const data = await CenterService.getAssignedCenter({
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

// @desc    Create new center
// @route   POST /api/centers
// @access  Private/Admin
export const createCenter = async (req, res) => {
  try {
    const data = await CenterService.createCenter({
      data: req.body,
      user: req.user,
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update center
// @route   PUT /api/centers/:id
// @access  Private/Admin
export const updateCenter = async (req, res) => {
  try {
    const data = await CenterService.updateCenter({
      id: req.params.id,
      data: req.body,
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

// @desc    Delete center
// @route   DELETE /api/centers/:id
// @access  Private/Admin
export const deleteCenter = async (req, res) => {
  try {
    const data = await CenterService.deleteCenter({
      id: req.params.id,
      user: req.user,
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      message: 'Center and linked database records removed.',
      deleted: data
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
