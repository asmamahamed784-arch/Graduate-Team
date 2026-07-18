const mongoose = require('mongoose');

const queueTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Can be null for walk-ins if they don't have an account
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }, // Link if created from an appointment
  ticketNumber: { type: String, required: true }, // e.g., 'A-001'
  status: {
    type: String,
    enum: ['waiting', 'serving', 'served', 'skipped', 'cancelled'],
    default: 'waiting'
  },
  issuedAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
  servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }, // The staff member who served them
  qrCode: { type: String }, // Optional for ticket tracking
});

module.exports = mongoose.model('QueueTicket', queueTicketSchema);
