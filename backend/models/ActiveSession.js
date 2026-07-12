import mongoose from 'mongoose';

const activeSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  lastActiveTime: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  },
  userAgent: {
    type: String,
    default: 'Unknown device'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  loggedOutAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const ActiveSession = mongoose.model('ActiveSession', activeSessionSchema);
export default ActiveSession;
