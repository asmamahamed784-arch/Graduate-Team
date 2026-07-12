import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Sent', 'Failed'],
    default: 'Sent'
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
});

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
