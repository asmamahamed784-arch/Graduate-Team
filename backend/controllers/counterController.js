import { CounterService } from '../services/counterService.js';

// @desc    Get all counters
// @route   GET /api/counters
// @access  Public
export const listCounters = async (req, res) => {
  try {
    const data = await CounterService.listCounters(req.user);
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
    const counter = await CounterService.createCounter(
      req.body,
      req.user,
      req.ip || '127.0.0.1'
    );
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
    const updated = await CounterService.updateCounter(
      req.params.id,
      req.body,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message === 'Counter not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Operators can only update counters for their assigned center.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete counter
// @route   DELETE /api/counters/:id
// @access  Private/Admin
export const deleteCounter = async (req, res) => {
  try {
    await CounterService.deleteCounter(
      req.params.id,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.json({ success: true, message: 'Counter removed.' });
  } catch (error) {
    if (error.message === 'Counter not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

