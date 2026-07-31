import prisma from '../config/prisma.js';
import { getAssignedCenterId, getRecordId, isStaffCenterRole, normalizeRole } from '../utils/rbac.js';

// @desc    Get all counters
// @route   GET /api/counters
// @access  Public
export const listCounters = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const query = isStaffCenterRole(role) ? { center: getAssignedCenterId(req.user) } : {};
    const counters = await prisma.counter.findMany({ where: query });
    const centerIds = [...new Set(counters.map((counter) => counter.center).filter(Boolean))];
    const centers = centerIds.length
      ? await prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, district: true } })
      : [];
    const centersById = new Map(centers.map((center) => [center.id, center]));
    const data = counters.map((counter) => ({
      ...counter,
      number: counter.prefix || `Counter ${counter.lastNumber || 0}`,
      center: centersById.get(counter.center) || counter.center
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create counter
// @route   POST /api/counters
// @access  Private/Admin
export const createCounter = async (req, res) => {
  try {
    const { number, centerId, prefix } = req.body;

    const counter = await prisma.counter.create({
      data: {
        center: centerId,
        lastNumber: Number(number || 0),
        prefix: prefix || 'NQS'
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Create Counter',
        details: `Created counter ${number} associated with center ID ${centerId}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.status(201).json({ success: true, data: counter });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update counter status or operator
// @route   PUT /api/counters/:id
// @access  Private/Operator or Admin
export const updateCounter = async (req, res) => {
  try {
    const counter = await prisma.counter.findUnique({
      where: { id: req.params.id }
    });

    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }

    if (isStaffCenterRole(req.user.role) && getRecordId(counter.center)?.toString() !== getAssignedCenterId(req.user)) {
      return res.status(403).json({ success: false, message: 'Operators can only update counters for their assigned center.' });
    }

    const updated = await prisma.counter.update({
      where: { id: req.params.id },
      data: {
        center: isStaffCenterRole(req.user.role) ? counter.center : (req.body.centerId || req.body.center || counter.center),
        lastNumber: Number(req.body.number ?? req.body.lastNumber ?? counter.lastNumber),
        prefix: req.body.prefix || counter.prefix
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Update Counter',
        details: `Updated counter ${counter.prefix} properties`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete counter
// @route   DELETE /api/counters/:id
// @access  Private/Admin
export const deleteCounter = async (req, res) => {
  try {
    const counter = await prisma.counter.findUnique({
      where: { id: req.params.id }
    });
    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }

    await prisma.counter.delete({
      where: { id: req.params.id }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Delete Counter',
        details: `Deleted counter ${counter.prefix}`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, message: 'Counter removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
