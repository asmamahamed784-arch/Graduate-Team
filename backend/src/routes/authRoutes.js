const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  registerUser,
  loginUser,
  verifyOtp,
  registerAdmin,
  loginAdmin,
  getMe
} = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ success: false, errors: errors.array() });
  };
};

// Public routes for Citizens
router.post('/register', validate([
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
]), registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/login', loginUser);

// Public route for Admin Login
router.post('/admin/login', loginAdmin);

// Protected routes
router.get('/me', protect, getMe);

// Admin-only route for creating new Admins
// Note: Made public temporarily to bootstrap the first superadmin. In production, this should be protected.
router.post('/admin/register', registerAdmin);

module.exports = router;
