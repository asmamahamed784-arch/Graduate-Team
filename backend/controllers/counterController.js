import Counter from '../models/Counter.js';
import AuditLog from '../models/AuditLog.js';
import { getAssignedCenterId, normalizeRole } from '../utils/rbac.js';

// @desc    Get all counters
// @route   GET /api/counters
// @access  Public
export const listCounters = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const query = role === 'operator' ? { center: getAssignedCenterId(req.user) } : {};
    const counters = await Counter.find(query).populate('center').populate('operator', 'name email');
    return res.json({ success: true, count: counters.length, data: counters });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create counter
// @route   POST /api/counters
// @access  Private/Admin
export const createCounter = async (req, res) => {
  try {
    const { number, centerId, operatorId, status } = req.body;

    const counter = await Counter.create({
      number,
      center: centerId,
      operator: operatorId || null,
      status: status || 'Inactive'
    });

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Create Counter',
      details: `Created counter ${number} associated with center ID ${centerId}`,
      ipAddress: req.ip || '127.0.0.1'
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
    const counter = await Counter.findById(req.params.id);

    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }

    if (normalizeRole(req.user.role) === 'operator' && counter.center.toString() !== getAssignedCenterId(req.user)) {
      return res.status(403).json({ success: false, message: 'Operators can only update counters for their assigned center.' });
    }

    const updated = await Counter.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update Counter',
      details: `Updated counter ${counter.number} properties`,
      ipAddress: req.ip || '127.0.0.1'
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
    const counter = await Counter.findById(req.params.id);
    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }

    await Counter.findByIdAndDelete(req.params.id);

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Delete Counter',
      details: `Deleted counter number ${counter.number}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Counter removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
