import prisma from '../config/prisma.js';
import {
  NATIONAL_ID_CATEGORY,
  NATIONAL_ID_CORE_SERVICES,
  NATIONAL_ID_SERVICE_NAMES,
} from '../utils/nqsScope.js';

const ensureCoreNationalIdServices = async () => {
  await Promise.all(
    NATIONAL_ID_CORE_SERVICES.map(async (service) => {
      const existing = await prisma.service.findFirst({
        where: { name: service.name, category: service.category }
      });
      if (!existing) {
        await prisma.service.create({ data: service });
      }
    })
  );
};

// @desc    Get all services
// @route   GET /api/services
// @access  Public
export const listServices = async (req, res) => {
  try {
    await ensureCoreNationalIdServices();
    const services = await prisma.service.findMany({
      where: {
        category: NATIONAL_ID_CATEGORY
      },
      orderBy: { name: 'asc' }
    });
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
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    if (service.category !== NATIONAL_ID_CATEGORY) {
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
    const { name, description, category = NATIONAL_ID_CATEGORY, duration, requirements, priority, status } = req.body;
    const cleanName = String(name || '').trim();
    const cleanDescription = String(description || '').trim();

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Service name is required' });
    }
    if (!cleanDescription) {
      return res.status(400).json({ success: false, message: 'Service description is required' });
    }
    if (category !== NATIONAL_ID_CATEGORY) {
      return res.status(400).json({ success: false, message: 'Service category must be National ID' });
    }

    const serviceExists = await prisma.service.findFirst({ where: { name: cleanName } });
    if (serviceExists) {
      return res.status(400).json({ success: false, message: 'Service name already exists' });
    }

    const service = await prisma.service.create({
      data: {
        name: cleanName,
        description: cleanDescription,
        category,
        duration: Number(duration) || 15,
        requirements,
        priority: priority || 'Medium',
        status: status || 'Active'
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Create Service',
        details: `Created new service: ${cleanName}`,
        ipAddress: req.ip || '127.0.0.1'
      }
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
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const nextName = String(req.body.name ?? service.name).trim();
    const nextCategory = req.body.category ?? service.category;
    if (!nextName) {
      return res.status(400).json({ success: false, message: 'Service name is required' });
    }
    if (nextCategory !== NATIONAL_ID_CATEGORY) {
      return res.status(400).json({ success: false, message: 'Service category must be National ID' });
    }

    const updatedService = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        name: nextName,
        category: nextCategory,
        duration: Number(req.body.duration ?? service.duration) || service.duration
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Update Service',
        details: `Updated service ID: ${service.id} (${service.name})`,
        ipAddress: req.ip || '127.0.0.1'
      }
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
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (NATIONAL_ID_SERVICE_NAMES.includes(service.name) && service.category === NATIONAL_ID_CATEGORY) {
      return res.status(400).json({
        success: false,
        message: 'Core National ID services are required and cannot be deleted'
      });
    }

    const linkedTickets = await prisma.ticket.count({ where: { service: service.id } });
    if (linkedTickets > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a service that has queue tickets'
      });
    }

    await prisma.service.delete({ where: { id: req.params.id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Delete Service',
        details: `Deleted service name: ${service.name}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, message: 'Service removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
