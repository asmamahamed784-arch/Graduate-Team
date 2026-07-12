import mongoose from 'mongoose';

const centerScheduleSchema = new mongoose.Schema({
  workingDays: {
    type: [String],
    default: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  },
  startTime: {
    type: String,
    default: '08:00'
  },
  endTime: {
    type: String,
    default: '16:00'
  },
  breakTime: {
    start: {
      type: String,
      default: ''
    },
    end: {
      type: String,
      default: ''
    }
  },
  slotDuration: {
    type: Number,
    default: 30,
    min: 5
  },
  maxBookingsPerSlot: {
    type: Number,
    default: 5,
    min: 1
  },
  maxAppointmentsPerDay: {
    type: Number,
    default: 100,
    min: 1
  },
  closedDays: {
    type: [String],
    default: ['Friday']
  },
  closedDates: {
    type: [String],
    default: []
  },
  specialUnavailableDates: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const centerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a center name'],
    unique: true,
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Please add an address']
  },
  city: {
    type: String,
    required: [true, 'Please add a city']
  },
  district: {
    type: String,
    required: [true, 'Please select a district'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number']
  },
  counters: {
    type: Number,
    required: [true, 'Please add number of active counters'],
    default: 5
  },
  capacity: {
    type: Number,
    required: [true, 'Please add daily capacity limit'],
    default: 100
  },
  hours: {
    type: String,
    required: [true, 'Please add operating hours'],
    default: '08:00 AM - 05:00 PM'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Closed'],
    default: 'Active'
  },
  schedule: {
    type: centerScheduleSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

const Center = mongoose.model('Center', centerSchema);
export default Center;
