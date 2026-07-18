const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['SMS', 'Email', 'Push'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  sentAt: { type: Date }
});

module.exports = mongoose.model('Notification', notificationSchema);
