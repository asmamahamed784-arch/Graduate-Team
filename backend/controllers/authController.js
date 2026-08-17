import { AuthService } from '../services/authService.js';

export const registerUser = async (req, res) => {
  try {
    const data = await AuthService.registerUser({
      body: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const data = await AuthService.loginUser({
      body: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message, retryAfter: error.retryAfter });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyLoginOtp = async (req, res) => {
  try {
    const data = await AuthService.verifyLoginOtp({
      body: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        attemptsRemaining: error.attemptsRemaining,
        newOtpSent: error.newOtpSent
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendLoginOtp = async (req, res) => {
  try {
    const data = await AuthService.resendLoginOtp({
      body: req.body
    });
    return res.json({ success: true, message: 'OTP sent.', data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        retryAfter: error.retryAfter
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const data = await AuthService.getUserProfile({
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

export const updateUserProfile = async (req, res) => {
  try {
    const data = await AuthService.updateUserProfile({
      body: req.body,
      user: req.user,
      ip: req.ip
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const data = await AuthService.changePassword({
      body: req.body,
      user: req.user,
      ip: req.ip
    });
    return res.json({ success: true, message: data.message });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUserAccount = async (req, res) => {
  try {
    const data = await AuthService.deleteUserAccount({
      user: req.user,
      ip: req.ip
    });
    return res.json({ success: true, message: data.message });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const data = await AuthService.logoutUser({
      tokenId: req.tokenId,
      user: req.user,
      req
    });
    return res.json({ success: true, message: data.message });
  } catch (error) {
    return res.json({ success: true, message: 'Logged out.' });
  }
};
