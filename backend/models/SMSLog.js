import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true
  },
  message: {
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

const SMSLog = mongoose.model('SMSLog', smsLogSchema);
export default SMSLog;
