import { OperatorService } from '../services/operatorService.js';

export const listOperators = async (req, res) => {
  try {
    const result = await OperatorService.listOperators(req.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.message === 'Your account is not assigned to a center.' ? 403 : 500).json({ success: false, message: error.message });
  }
};

export const getOperatorCenterStats = async (req, res) => {
  try {
    const result = await OperatorService.getOperatorCenterStats();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOperator = async (req, res) => {
  try {
    const data = await OperatorService.createOperator(req.body, req.user, req.ip, req.app.get('io'));
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (
      error.message === 'Center managers can only manage their assigned center.' ||
      error.message === 'Center managers cannot move staff to another center.'
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message === 'Assigned center not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes('required') ||
      error.message.includes('valid Somali number') ||
      error.message.includes('Username may contain') ||
      error.message.includes('already in use')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOperator = async (req, res) => {
  try {
    const data = await OperatorService.updateOperator(req.params.id, req.body, req.user, req.ip);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.message === 'Operator not found.' || error.message === 'Assigned center not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message === 'Center managers can only manage their assigned center.' ||
      error.message === 'Center managers cannot move staff to another center.'
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (
      error.message.includes('valid Somali number') ||
      error.message.includes('already in use')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const setOperatorApprovalStatus = async (req, res, status, action) => {
  try {
    const data = await OperatorService.setOperatorApprovalStatus(req.params.id, status, action, req.user, req.ip, req);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.message === 'Operator not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const approveOperator = (req, res) => setOperatorApprovalStatus(req, res, 'active', 'Approve Operator');

export const rejectOperator = (req, res) => setOperatorApprovalStatus(req, res, 'rejected', 'Reject Operator');

export const activateOperator = (req, res) => setOperatorApprovalStatus(req, res, 'active', 'Activate Operator');

export const deactivateOperator = (req, res) => setOperatorApprovalStatus(req, res, 'inactive', 'Deactivate Operator');

export const getOperatorDetails = async (req, res) => {
  try {
    const data = await OperatorService.getOperatorDetails(req.params.id, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.message === 'Operator not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Center managers can only view staff from their assigned center.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOperator = async (req, res) => {
  try {
    const result = await OperatorService.deleteOperator(req.params.id, req.user, req.ip);
    return res.json({ success: true, message: result.message });
  } catch (error) {
    if (error.message === 'Operator not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetOperatorPassword = async (req, res) => {
  try {
    const result = await OperatorService.resetOperatorPassword(req.params.id, req.body, req.user, req.ip);
    return res.json({ success: true, message: result.message });
  } catch (error) {
    if (error.message === 'Operator not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Center managers can only manage their assigned center.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message === 'Temporary password must be at least 6 characters.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
