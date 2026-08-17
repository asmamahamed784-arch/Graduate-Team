import { QueueService } from '../services/queueService.js';

// @desc    Generate walk-in ticket (typically by receptionist or kiosk)
// @route   POST /api/queue/generate
// @access  Private/Operator or Admin
export const generateWalkInTicket = async (req, res) => {
  try {
    const data = await QueueService.generateWalkInTicket({
      body: req.body,
      user: req.user,
      ipAddress: req.ip,
      io: req.app.get('io')
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Call next ticket in queue
// @route   POST /api/queue/call-next
// @access  Private/Operator or Admin
export const callNextTicket = async (req, res) => {
  try {
    const data = await QueueService.callNextTicket({
      body: req.body,
      user: req.user,
      ipAddress: req.ip,
      io: req.app.get('io')
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Put current serving ticket on hold
// @route   PUT /api/queue/:id/hold
// @access  Private/Operator or Admin
export const holdTicket = async (req, res) => {
  try {
    const data = await QueueService.holdTicket({
      id: req.params.id,
      user: req.user,
      ipAddress: req.ip,
      io: req.app.get('io')
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete current ticket
// @route   PUT /api/queue/:id/complete
// @access  Private/Operator or Admin
export const completeTicket = async (req, res) => {
  try {
    const data = await QueueService.completeTicket({
      id: req.params.id,
      body: req.body,
      user: req.user,
      ipAddress: req.ip,
      io: req.app.get('io')
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get live queue for specific center
// @route   GET /api/queue/live/:centerId
// @access  Public
export const getLiveQueue = async (req, res) => {
  try {
    const data = await QueueService.getLiveQueue(req.params.centerId);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track queue position for a ticket reference code
// @route   GET /api/queue/track/:ref
// @access  Public
export const trackTicket = async (req, res) => {
  try {
    const data = await QueueService.trackTicket(req.params.ref, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tickets in the system (Admin overview)
// @route   GET /api/queue
// @access  Private/Operator or Admin
export const listTickets = async (req, res) => {
  try {
    const data = await QueueService.listTickets({
      query: req.query,
      user: req.user
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
