import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    match: [/^[a-z0-9._-]+$/, 'Username can contain letters, numbers, dots, underscores, and hyphens only']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  nationalId: {
    type: String,
    default: ''
  },
  photo: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false // Exclude from query results by default
  },
  role: {
    type: String,
    enum: ['admin', 'operator', 'super_operator', 'citizen'],
    default: 'citizen'
  },
  operatorType: {
    type: String,
    enum: ['operator', 'super_operator'],
    default: 'operator'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  lastActiveAt: {
    type: Date,
    default: null
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    default: null
  }
}, {
  timestamps: true
});

userSchema.pre('validate', function (next) {
  if (!this.username) {
    const fallback = this.email
      ? this.email.split('@')[0]
      : this.name;
    this.username = String(fallback || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }
  if (this.role === 'super_operator') {
    this.operatorType = 'super_operator';
  }
  next();
});

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
