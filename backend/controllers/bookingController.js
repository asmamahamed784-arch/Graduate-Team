import { BookingService } from '../services/bookingService.js';

export const getBookingAvailability = async (req, res) => {
  try {
    const data = await BookingService.getBookingAvailability({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const data = await BookingService.createBooking({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const data = await BookingService.getUserBookings({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const data = await BookingService.getAllBookings({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sendCorrectionFeedback = async (req, res) => {
  try {
    const data = await BookingService.sendCorrectionFeedback({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const data = await BookingService.updateRequestStatus({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const data = await BookingService.updateBookingStatus({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingDetails = async (req, res) => {
  try {
    const data = await BookingService.getBookingDetails({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const data = await BookingService.cancelBooking({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resubmitBooking = async (req, res) => {
  try {
    const data = await BookingService.resubmitBooking({
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user,
      ip: req.ip,
      io: req.app ? req.app.get('io') : null
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

