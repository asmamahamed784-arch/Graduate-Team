const mongoose = require('mongoose');

const serviceCenterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  city: { type: String, required: true },
  contactNumber: { type: String },
  operatingHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '16:00' }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServiceCenter', serviceCenterSchema);
