import User from '../models/User.js';
import Center from '../models/Center.js';
import AuditLog from '../models/AuditLog.js';
import { normalizeRole } from '../utils/rbac.js';

const operatorSelect = 'name username email phone role operatorType status center mustChangePassword createdAt updatedAt';

const serializeOperator = (operator) => ({
  _id: operator._id,
  id: operator._id,
  name: operator.name,
  username: operator.username,
  email: operator.email,
  phone: operator.phone,
  role: normalizeRole(operator.role),
  operatorType: operator.operatorType,
  status: operator.status,
  center: operator.center,
  mustChangePassword: operator.mustChangePassword,
  createdAt: operator.createdAt,
  updatedAt: operator.updatedAt
});

const normalizeOperatorType = (operatorType) => (
  operatorType === 'super_operator' ? 'super_operator' : 'operator'
);

export const listOperators = async (req, res) => {
  try {
    const query = { role: { $in: ['operator', 'super_operator'] } };
    const requesterRole = normalizeRole(req.user.role);

    if (requesterRole === 'super_operator') {
      query.center = req.user.center;
    }

    const operators = await User.find(query)
      .select(operatorSelect)
      .populate('center', 'name address city')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: operators.length, data: operators.map(serializeOperator) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOperator = async (req, res) => {
  try {
    const { name, username, email, phone, center, operatorType = 'operator', status = 'active', temporaryPassword } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanOperatorType = normalizeOperatorType(operatorType);

    if (!name || !cleanUsername || !phone || !center || !temporaryPassword) {
      return res.status(400).json({ success: false, message: 'Name, username, phone, center, and temporary password are required.' });
    }

    const centerExists = await Center.findById(center);
    if (!centerExists) {
      return res.status(404).json({ success: false, message: 'Assigned center not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === 'super_operator' && req.user.center?.toString() !== center.toString()) {
      return res.status(403).json({ success: false, message: 'Super operators can only manage their assigned center.' });
    }

    const exists = await User.findOne({
      $or: [
        { username: cleanUsername },
        ...(email ? [{ email: String(email).trim().toLowerCase() }] : [])
      ]
    });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Username or email is already in use.' });
    }

    const operator = await User.create({
      name,
      username: cleanUsername,
      email: email ? String(email).trim().toLowerCase() : undefined,
      phone,
      password: temporaryPassword,
      role: cleanOperatorType,
      operatorType: cleanOperatorType,
      status,
      center,
      mustChangePassword: true
    });

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Create Operator',
      details: `Created ${cleanOperatorType} username ${cleanUsername} for ${centerExists.name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const populated = await User.findById(operator._id).select(operatorSelect).populate('center', 'name address city');
    return res.status(201).json({ success: true, data: serializeOperator(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOperator = async (req, res) => {
  try {
    const { name, email, phone, center, operatorType, status } = req.body;
    const operator = await User.findById(req.params.id);

    if (!operator || !['operator', 'super_operator'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === 'super_operator' && operator.center?.toString() !== req.user.center?.toString()) {
      return res.status(403).json({ success: false, message: 'Super operators can only manage their assigned center.' });
    }

    const nextCenter = center || operator.center;
    if (requesterRole === 'super_operator' && nextCenter?.toString() !== req.user.center?.toString()) {
      return res.status(403).json({ success: false, message: 'Super operators cannot move staff to another center.' });
    }

    if (email && email !== operator.email) {
      const emailTaken = await User.findOne({ email: String(email).trim().toLowerCase(), _id: { $ne: operator._id } });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: 'Email is already in use.' });
      }
    }

    const cleanOperatorType = operatorType ? normalizeOperatorType(operatorType) : operator.operatorType;
    operator.name = name || operator.name;
    operator.email = email === '' ? undefined : (email || operator.email);
    operator.phone = phone || operator.phone;
    operator.center = nextCenter;
    operator.operatorType = cleanOperatorType;
    operator.role = cleanOperatorType;
    operator.status = status || operator.status;
    await operator.save();

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update Operator',
      details: `Updated operator username ${operator.username}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const populated = await User.findById(operator._id).select(operatorSelect).populate('center', 'name address city');
    return res.json({ success: true, data: serializeOperator(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetOperatorPassword = async (req, res) => {
  try {
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Temporary password must be at least 6 characters.' });
    }

    const operator = await User.findById(req.params.id).select('+password');
    if (!operator || !['operator', 'super_operator'].includes(normalizeRole(operator.role))) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === 'super_operator' && operator.center?.toString() !== req.user.center?.toString()) {
      return res.status(403).json({ success: false, message: 'Super operators can only manage their assigned center.' });
    }

    operator.password = temporaryPassword;
    operator.mustChangePassword = true;
    await operator.save();

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Reset Operator Password',
      details: `Reset password for operator username ${operator.username}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Temporary password set. Operator must change password on next login.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
