const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['superadmin', 'manager', 'staff'], 
    default: 'staff' 
  },
  serviceCenterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ServiceCenter' 
  }, // For staff/managers bound to specific centers
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AdminUser', adminUserSchema);
