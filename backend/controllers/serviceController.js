import Service from '../models/Service.js';
import AuditLog from '../models/AuditLog.js';
import Ticket from '../models/Ticket.js';
import {
  NATIONAL_ID_CATEGORY,
  NATIONAL_ID_CORE_SERVICES,
  NATIONAL_ID_SERVICE_NAMES,
  isNationalIdService
} from '../utils/nqsScope.js';

const ensureCoreNationalIdServices = async () => {
  await Promise.all(
    NATIONAL_ID_CORE_SERVICES.map((service) => Service.updateOne(
      { name: service.name, category: service.category },
      { $setOnInsert: service },
      { upsert: true }
    ))
  );
};

// @desc    Get all services
// @route   GET /api/services
// @access  Public
export const listServices = async (req, res) => {
  try {
    await ensureCoreNationalIdServices();
    const services = await Service.find({
      name: { $in: NATIONAL_ID_SERVICE_NAMES },
      category: NATIONAL_ID_CATEGORY
    }).sort({ name: 1 });
    return res.json({ success: true, count: services.length, data: services });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get service by ID
// @route   GET /api/services/:id
// @access  Public
export const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    if (!isNationalIdService(service)) {
      return res.status(404).json({ success: false, message: 'Service is outside the NQS scope' });
    }
    return res.json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private/Admin
export const createService = async (req, res) => {
  try {
    const { name, description, category, duration, requirements, priority } = req.body;

    if (!NATIONAL_ID_SERVICE_NAMES.includes(name) || category !== NATIONAL_ID_CATEGORY) {
      return res.status(400).json({
        success: false,
        message: 'NQS supports National ID Registration, lost National ID replacement, and National ID information update only'
      });
    }

    const serviceExists = await Service.findOne({ name });
    if (serviceExists) {
      return res.status(400).json({ success: false, message: 'Service name already exists' });
    }

    const service = await Service.create({
      name,
      description,
      category,
      duration,
      requirements,
      priority
    });

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Create Service',
      details: `Created new service: ${name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const nextName = req.body.name ?? service.name;
    const nextCategory = req.body.category ?? service.category;
    if (!NATIONAL_ID_SERVICE_NAMES.includes(nextName) || nextCategory !== NATIONAL_ID_CATEGORY) {
      return res.status(400).json({
        success: false,
        message: 'NQS supports National ID Registration, lost National ID replacement, and National ID information update only'
      });
    }

    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update Service',
      details: `Updated service ID: ${service._id} (${service.name})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, data: updatedService });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (isNationalIdService(service)) {
      return res.status(400).json({
        success: false,
        message: 'Core National ID services are required and cannot be deleted'
      });
    }

    const linkedTickets = await Ticket.countDocuments({ service: service._id });
    if (linkedTickets > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a service that has queue tickets'
      });
    }

    await Service.findByIdAndDelete(req.params.id);

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Delete Service',
      details: `Deleted service name: ${service.name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Service removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
