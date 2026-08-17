import { UserService } from '../services/userService.js';

export const listUsers = async (req, res) => {
  try {
    const users = await UserService.listUsers(req.query);
    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { admin, temporaryPassword } = await UserService.createAdminUser(
      req.body,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.status(201).json({
      success: true,
      data: { ...admin, _id: admin.id },
      temporaryPassword,
      message: 'Account created. Show this generated password once and store it securely.'
    });
  } catch (error) {
    if (error.message.includes('already in use')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (['Name, username, and phone are required.', 'Username may contain', 'Password must be at least'].some(msg => error.message.includes(msg))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const data = await UserService.getUserDetails(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const data = await UserService.updateUserStatus(
      req.params.id,
      req.body.status,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.json({ success: true, data });
  } catch (error) {
    if (error.message === 'Invalid user status.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === 'User not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    await UserService.deleteAdminUser(
      req.params.id,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.json({ success: true, message: 'User deleted.' });
  } catch (error) {
    if (['You cannot delete', 'At least one admin'].some(msg => error.message.includes(msg))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === 'Managed account not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    await UserService.resetUserPassword(
      req.params.id,
      req.body.temporaryPassword,
      req.user,
      req.ip || '127.0.0.1'
    );
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    if (error.message.includes('must be at least 6 characters')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === 'User not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
