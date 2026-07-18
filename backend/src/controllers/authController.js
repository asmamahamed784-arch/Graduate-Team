const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register a citizen user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, error: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (isVerified will be false initially)
    user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });

    res.status(201).json({
      success: true,
      message: 'User registered. Please verify OTP.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Mock Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    
    // In a real scenario, check OTP from Redis or DB
    if (otp !== '1234') { // Mock OTP logic
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);
    res.status(200).json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Login a citizen user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
        return res.status(401).json({ success: false, error: 'Please verify your account first' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    res.status(200).json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Register an Admin User
// @route   POST /api/auth/admin/register
// @access  Private/SuperAdmin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role, serviceCenterId } = req.body;

    let admin = await AdminUser.findOne({ email });
    if (admin) {
      return res.status(400).json({ success: false, error: 'Admin already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    admin = await AdminUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      serviceCenterId
    });

    res.status(201).json({ success: true, admin: { id: admin._id, name: admin.name, role: admin.role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Login an Admin User
// @route   POST /api/auth/admin/login
// @access  Public
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await AdminUser.findOne({ email });
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = generateToken(admin._id);
    res.status(200).json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current logged in user (Citizen or Admin)
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: req.user, userType: req.userType });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
