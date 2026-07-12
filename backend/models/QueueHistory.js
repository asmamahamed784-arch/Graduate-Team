import mongoose from 'mongoose';

const queueHistorySchema = new mongoose.Schema({
  ticketRef: {
    type: String,
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  citizenName: {
    type: String,
    required: true
  },
  counter: {
    type: String,
    required: true
  },
  waitTime: {
    type: Number, // in minutes
    required: true
  },
  serviceTime: {
    type: Number, // in minutes
    required: true
  },
  status: {
    type: String, // Completed / Cancelled
    required: true
  },
  date: {
    type: String,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const QueueHistory = mongoose.model('QueueHistory', queueHistorySchema);
export default QueueHistory;
