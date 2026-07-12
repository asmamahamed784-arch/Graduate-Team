import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import ActiveSession from '../models/ActiveSession.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendRegistrationEmail } from '../services/emailService.js';
import { normalizeRole, normalizeUserRole } from '../utils/rbac.js';

const generateToken = (id, role) => {
  const tokenId = crypto.randomUUID();
  return {
    tokenId,
    token: jwt.sign({ id, role: normalizeRole(role), jti: tokenId }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    })
  };
};

const publicUserPayload = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  nationalId: user.nationalId,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  role: normalizeRole(user.role),
  operatorType: user.operatorType,
  status: user.status,
  center: user.center,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt
});

const usernameFrom = (value) => String(value || '').trim().toLowerCase();
const USERNAME_RULE_MESSAGE = 'Username must contain letters only.';
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include letters, numbers, and a special character.';

const isLettersOnlyUsername = (value) => /^[A-Za-z]+$/.test(String(value || ''));
const isStrongPassword = (value) => /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(value || ''));
let optionalEmailIndexReady = false;

const ensureOptionalEmailIndex = async () => {
  if (optionalEmailIndexReady) return;
  try {
    const indexes = await User.collection.indexes();
    const emailIndex = indexes.find((index) => index.name === 'email_1');
    const hasOptionalEmailIndex = emailIndex?.unique && emailIndex?.partialFilterExpression;

    if (!hasOptionalEmailIndex) {
      if (emailIndex) {
        await User.collection.dropIndex('email_1');
      }
      await User.collection.createIndex(
        { email: 1 },
        {
          name: 'email_1',
          unique: true,
          partialFilterExpression: { email: { $type: 'string' } }
        }
      );
    }
  } catch {
    // Registration can continue; duplicate key handling below returns a clear message if the index still blocks it.
  } finally {
    optionalEmailIndexReady = true;
  }
};

const createActiveSession = async ({ req, user, tokenId }) => {
  await ActiveSession.create({
    user: user._id,
    tokenId,
    username: user.username,
    role: normalizeRole(user.role),
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.get('user-agent') || 'Unknown device'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const rawUsername = String(username || '');
    const cleanUsername = usernameFrom(username);

    if (!cleanUsername) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    if (rawUsername !== rawUsername.trim() || !isLettersOnlyUsername(rawUsername)) {
      return res.status(400).json({ success: false, message: USERNAME_RULE_MESSAGE });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_RULE_MESSAGE });
    }

    const userExists = await User.findOne({
      $or: [
        { username: cleanUsername },
        ...(email ? [{ email: String(email).trim().toLowerCase() }] : [])
      ]
    });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    // Public registration always creates citizen accounts.
    const userRole = 'citizen';
    await ensureOptionalEmailIndex();

    const userPayload = {
      name: cleanUsername,
      username: cleanUsername,
      phone: '',
      password,
      role: userRole
    };
    if (email) {
      userPayload.email = String(email).trim().toLowerCase();
    }

    const user = await User.create(userPayload);

    if (user) {
      // Create audit log
      await AuditLog.create({
        user: user._id,
        role: userRole,
        action: 'User Registration',
        details: `Registered citizen account for username: ${cleanUsername}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      if (user.email) {
        await sendRegistrationEmail(user);
      }

      const { token, tokenId } = generateToken(user._id, user.role);
      await createActiveSession({ req, user, tokenId });

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: publicUserPayload(user)
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(400).json({ success: false, message: 'Email is already in use.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const identifier = usernameFrom(username);

    if (!identifier) {
      return res.status(401).json({ success: false, message: 'Username not found. Please register first.' });
    }

    if (!password) {
      return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    let user = await User.findOne({ username: identifier }).select('+password').populate('center');

    if (!user && ['admin', 'operator'].includes(identifier)) {
      user = await User.findOne({ email: `${identifier}.nqs@gov.so` }).select('+password').populate('center');
      if (user && !user.username) {
        user.username = identifier;
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username not found. Please register first.' });
    }

    if (!(await user.matchPassword(password))) {
      await AuditLog.create({
        user: user._id,
        role: normalizeRole(user.role),
        action: 'User Login Failed',
        details: `Failed authentication attempt for username: ${identifier}`,
        ipAddress: req.ip || '127.0.0.1',
      });
      return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    await normalizeUserRole(user);
    if (!user.username) {
      user.username = identifier;
    }

    if (['operator', 'super_operator'].includes(user.role) && user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This operator account is inactive. Contact the administrator.' });
    }

    if (user.isModified('username') || user.isModified('role')) {
      await user.save();
    }

    await AuditLog.create({
      user: user._id,
      role: normalizeRole(user.role),
      action: 'User Login',
      details: `User signed in: ${user.username}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    const { token, tokenId } = generateToken(user._id, user.role);
    await createActiveSession({ req, user, tokenId });

    return res.json({
      success: true,
      data: {
        token,
        user: publicUserPayload(user)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('center');

    if (user) {
      await normalizeUserRole(user);
      return res.json({
        success: true,
        data: publicUserPayload(user)
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, email, phone, nationalId, dateOfBirth, address } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
    }

    user.name = name || user.name;
    user.email = email === '' ? undefined : (email || user.email);
    user.phone = phone || user.phone;
    user.nationalId = nationalId ?? user.nationalId;
    user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;
    user.address = address ?? user.address;
    user.role = normalizeRole(user.role);
    await user.save();

    await AuditLog.create({
      user: user._id,
      role: normalizeRole(user.role),
      action: 'Update Profile',
      details: `Updated profile details${nationalId || dateOfBirth || address ? ' with extended citizen fields' : ''}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.json({
      success: true,
      data: publicUserPayload(user)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change current user password
// @route   PUT /api/auth/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    await AuditLog.create({
      user: user._id,
      role: normalizeRole(user.role),
      action: 'Change Password',
      details: 'Updated account password',
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.json({ success: true, message: 'Password updated.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete current user account
// @route   DELETE /api/auth/profile
// @access  Private
export const deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await AuditLog.create({
      user: user._id,
      role: normalizeRole(user.role),
      action: 'Delete Account',
      details: `Deleted account for username: ${user.username}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    await User.findByIdAndDelete(user._id);

    return res.json({ success: true, message: 'Account deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout current session
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    if (req.tokenId) {
      await ActiveSession.findOneAndUpdate(
        { tokenId: req.tokenId },
        { status: 'inactive', loggedOutAt: new Date(), lastActiveTime: new Date() }
      );
    }
    return res.json({ success: true, message: 'Logged out.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
