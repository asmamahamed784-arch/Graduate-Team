const Service = require('../models/Service');
const ServiceCenter = require('../models/ServiceCenter');

// --- Services ---

// @desc    Get all services
// @route   GET /api/services
// @access  Public
exports.getServices = async (req, res) => {
  try {
    const services = await Service.find();
    res.status(200).json({ success: true, count: services.length, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private/Admin
exports.createService = async (req, res) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Service Centers ---

// @desc    Get all service centers
// @route   GET /api/service-centers
// @access  Public
exports.getServiceCenters = async (req, res) => {
  try {
    const centers = await ServiceCenter.find();
    res.status(200).json({ success: true, count: centers.length, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new service center
// @route   POST /api/service-centers
// @access  Private/Admin
exports.createServiceCenter = async (req, res) => {
  try {
    const center = await ServiceCenter.create(req.body);
    res.status(201).json({ success: true, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
