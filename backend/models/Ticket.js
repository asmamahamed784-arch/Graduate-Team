import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ref: {
    type: String,
    required: [true, 'Please add a reference code'],
    unique: true,
    trim: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Please associate a service']
  },
  citizenName: {
    type: String,
    required: [true, 'Please add citizen name']
  },
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  counter: {
    type: String,
    default: '--'
  },
  waitTime: {
    type: String,
    default: '15 min'
  },
  status: {
    type: String,
    enum: ['Waiting', 'Being Served', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Waiting'
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: [true, 'Please associate a center']
  },
  date: {
    type: String, // format YYYY-MM-DD
    default: ''
  },
  timeSlot: {
    type: String,
    default: null
  },
  requestType: {
    type: String,
    enum: ['new_national_id', 'lost_replacement', 'update_information'],
    default: 'new_national_id'
  },
  requestStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Resubmission Required'],
    default: 'Pending'
  },
  registrationDetails: {
    fullName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    motherName: { type: String, trim: true, default: '' },
    dateOfBirth: { type: String, trim: true, default: '' },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['', 'Male', 'Female', 'Other'], default: '' },
    district: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    fullAddress: { type: String, trim: true, default: '' },
    nearestLandmark: { type: String, trim: true, default: '' },
    selectedCenter: { type: String, trim: true, default: '' },
    centerDistrict: { type: String, trim: true, default: '' },
    appointmentDate: { type: String, trim: true, default: '' },
    appointmentTime: { type: String, trim: true, default: '' }
  },
  replacementDetails: {
    fullName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    nationalIdNumber: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '' },
    dateLost: { type: String, trim: true, default: '' },
    placeLost: { type: String, trim: true, default: '' },
    policeReportNumber: { type: String, trim: true, default: '' },
    policeReportDocument: { type: String, trim: true, default: '' },
    additionalNotes: { type: String, trim: true, default: '' }
  },
  updateDetails: {
    fullName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    nationalIdNumber: { type: String, trim: true, default: '' },
    selectedFields: {
      type: [String],
      default: []
    },
    changes: [{
      field: { type: String, trim: true, default: '' },
      currentValue: { type: String, trim: true, default: '' },
      newValue: { type: String, trim: true, default: '' },
      reason: { type: String, trim: true, default: '' }
    }],
    fieldToUpdate: {
      type: String,
      enum: ['', 'Full Name', 'Phone Number', 'Address', 'Date of Birth', 'Mother’s Name', "Mother's Name", 'Other'],
      default: ''
    },
    currentValue: { type: String, trim: true, default: '' },
    newValue: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' }
  },
  existingRegistration: {
    found: { type: Boolean, default: false },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null
    },
    ticketNumber: { type: String, trim: true, default: '' },
    queueNumber: { type: String, trim: true, default: '' },
    serviceType: { type: String, trim: true, default: '' },
    centerName: { type: String, trim: true, default: '' },
    centerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Center',
      default: null
    },
    date: { type: String, trim: true, default: '' },
    timeSlot: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: '' }
  },
  documents: [{
    name: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    documentType: { type: String, trim: true, default: 'supporting_document' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  cancellationReason: {
    type: String,
    trim: true,
    default: ''
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  needsResubmission: {
    type: Boolean,
    default: false
  },
  resubmissionHistory: [{
    submittedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: '' }
  }],
  calledAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
