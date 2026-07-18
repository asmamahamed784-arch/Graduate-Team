const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'USER_LOGIN', 'TICKET_GENERATED'
  performedBy: { 
    userId: { type: mongoose.Schema.Types.ObjectId },
    userType: { type: String, enum: ['User', 'AdminUser', 'System'] }
  },
  target: {
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetModel: { type: String } // e.g., 'Appointment', 'QueueTicket'
  },
  details: { type: mongoose.Schema.Types.Mixed }, // Any additional info
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
