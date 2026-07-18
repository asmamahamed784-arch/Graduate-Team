const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: true }, // Changed to true for easier testing without OTP for now
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
