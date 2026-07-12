import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true
  },
  darkMode: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    enum: ['en', 'so', 'ar', 'es', 'fr'],
    default: 'en'
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  emailNotif: {
    type: Boolean,
    default: true
  },
  smsNotif: {
    type: Boolean,
    default: false
  },
  pushNotif: {
    type: Boolean,
    default: true
  },
  publicProfile: {
    type: Boolean,
    default: true
  },
  dataCollection: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
