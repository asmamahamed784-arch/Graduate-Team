import mongoose from 'mongoose';

const qrScanSchema = new mongoose.Schema({
  ticketRef: {
    type: String,
    required: true
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scannedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Valid', 'Invalid', 'Expired', 'Cancelled', 'Completed', 'Verified', 'Arrived', 'Rejected'],
    default: 'Valid'
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  }
}, {
  timestamps: true
});

const QRScan = mongoose.model('QRScan', qrScanSchema);
export default QRScan;
