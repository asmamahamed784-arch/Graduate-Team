import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Center from '../models/Center.js';
import Ticket from '../models/Ticket.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Role from '../models/Role.js';
import Counter from '../models/Counter.js';
import Announcement from '../models/Announcement.js';
import SystemConfig from '../models/SystemConfig.js';
import Setting from '../models/Setting.js';
import QueueHistory from '../models/QueueHistory.js';
import Feedback from '../models/Feedback.js';
import ContactMessage from '../models/ContactMessage.js';

dotenv.config();
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')
});

const FIRST_ADMIN = {
  username: 'admin',
  password: 'Admin@12345',
  role: 'admin',
  name: 'NQS Administrator',
  status: 'active'
};

const DEFAULT_OPERATOR = {
  username: 'operator',
  password: 'Operator@123',
  role: 'operator',
  name: 'National ID Operator',
  status: 'active',
  email: 'operator.nqs@gov.so',
  phone: '+252 61 000 0002'
};

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected for National ID NQS seeding...');
};

const ensureFirstAdmin = async () => {
  let admin = await User.findOne({
    $or: [
      { username: FIRST_ADMIN.username },
      { email: 'admin.nqs@gov.so' }
    ]
  }).select('+password');

  if (!admin) {
    admin = await User.create({
      name: FIRST_ADMIN.name,
      username: FIRST_ADMIN.username,
      email: 'admin.nqs@gov.so',
      phone: '+252 61 000 0001',
      password: FIRST_ADMIN.password,
      role: FIRST_ADMIN.role,
      status: FIRST_ADMIN.status
    });
    console.log('First admin account created: username admin / password Admin@12345');
    return admin;
  }

  const passwordMatches = await admin.matchPassword(FIRST_ADMIN.password);
  admin.name = FIRST_ADMIN.name;
  admin.username = FIRST_ADMIN.username;
  admin.role = FIRST_ADMIN.role;
  admin.status = FIRST_ADMIN.status;
  admin.email = admin.email || 'admin.nqs@gov.so';
  admin.phone = admin.phone || '+252 61 000 0001';

  if (!passwordMatches) {
    admin.password = FIRST_ADMIN.password;
  }

  await admin.save();
  console.log('First admin account already exists and is ready: username admin / password Admin@12345');
  return admin;
};

const ensureDefaultOperator = async () => {
  let operator = await User.findOne({
    $or: [
      { username: DEFAULT_OPERATOR.username },
      { email: DEFAULT_OPERATOR.email }
    ]
  }).select('+password');
  const center = await Center.findOne({ status: { $in: ['Active', 'Open'] } });

  if (!operator) {
    operator = await User.create({
      name: DEFAULT_OPERATOR.name,
      username: DEFAULT_OPERATOR.username,
      email: DEFAULT_OPERATOR.email,
      phone: DEFAULT_OPERATOR.phone,
      password: DEFAULT_OPERATOR.password,
      role: DEFAULT_OPERATOR.role,
      operatorType: 'operator',
      status: DEFAULT_OPERATOR.status,
      center: center?._id || null
    });
    console.log('Default operator account created: username operator / password Operator@123');
    return operator;
  }

  const passwordMatches = await operator.matchPassword(DEFAULT_OPERATOR.password);
  operator.name = DEFAULT_OPERATOR.name;
  operator.username = DEFAULT_OPERATOR.username;
  operator.email = operator.email || DEFAULT_OPERATOR.email;
  operator.phone = operator.phone || DEFAULT_OPERATOR.phone;
  operator.role = DEFAULT_OPERATOR.role;
  operator.operatorType = 'operator';
  operator.status = DEFAULT_OPERATOR.status;
  operator.center = operator.center || center?._id || null;

  if (!passwordMatches) {
    operator.password = DEFAULT_OPERATOR.password;
  }

  await operator.save();
  console.log('Default operator account already exists and is ready: username operator / password Operator@123');
  return operator;
};

const servicesData = [
  {
    name: 'National ID Registration',
    description: 'Apply for a new National ID card, update citizen identity details, or receive appointment support for National ID services.',
    category: 'National ID',
    duration: 15,
    priority: 'High',
    requirements: ['Existing identification or birth record', 'Recent ID photo', 'Completed National ID application form']
  },
  {
    name: 'Replace Lost National ID',
    description: 'Use this option if your National ID card is lost and you need a replacement.',
    category: 'National ID',
    duration: 20,
    priority: 'High',
    requirements: ['National ID Number if known', 'Police report number if available', 'Passport-size Photo']
  },
  {
    name: 'Update National ID Information',
    description: 'Use this option if you need to correct or update your National ID information.',
    category: 'National ID',
    duration: 20,
    priority: 'Medium',
    requirements: ['National ID Number', 'Current information', 'Corrected information', 'Supporting notes']
  }
];

const centerDistricts = [
  { district: 'Hodan', name: 'Banaadir National ID Center', address: 'Banaadir Regional Administration, Mogadishu', counters: 12, capacity: 500 },
  { district: 'Hodan', counters: 8, capacity: 350 },
  { district: 'Xamar Weyne', counters: 6, capacity: 260 },
  { district: 'Xamar Jajab', counters: 5, capacity: 220 },
  { district: 'Wadajir', counters: 6, capacity: 250 },
  { district: 'Dharkenley', counters: 6, capacity: 240 },
  { district: 'Yaqshiid', counters: 6, capacity: 240 },
  { district: 'Kaaraan', counters: 5, capacity: 220 },
  { district: 'Waaberi', counters: 5, capacity: 200 },
  { district: 'Shangaani', counters: 4, capacity: 160 },
  { district: 'Shibis', counters: 4, capacity: 170 },
  { district: 'Boondheere', counters: 4, capacity: 170 },
  { district: 'Abdulaziz', counters: 4, capacity: 160 },
  { district: 'Dayniile', counters: 5, capacity: 210 },
  { district: 'Kaxda', counters: 5, capacity: 210 },
  { district: 'Heliwaa', counters: 5, capacity: 220 },
  { district: 'Howlwadaag', counters: 5, capacity: 220 },
  { district: 'Wardhiigley', counters: 5, capacity: 220 },
  { district: 'Garasbaaley', counters: 4, capacity: 160 }
];

const centersData = centerDistricts.map((center, index) => ({
  name: center.name || `${center.district} National ID Center`,
  address: center.address || `${center.district} District Office, Mogadishu`,
  city: 'Banaadir',
  district: center.district,
  phone: `+252 61 000 ${String(1001 + index).padStart(4, '0')}`,
  counters: center.counters,
  capacity: center.capacity,
  hours: '08:00 - 16:00',
  status: 'Active',
  schedule: {
    workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    startTime: index % 3 === 0 ? '09:00' : '08:00',
    endTime: index % 3 === 0 ? '15:00' : '16:00',
    breakTime: { start: '', end: '' },
    slotDuration: 30,
    maxBookingsPerSlot: Math.max(2, Math.min(8, center.counters)),
    maxAppointmentsPerDay: center.capacity,
    closedDays: ['Friday', 'Saturday'],
    closedDates: [],
    specialUnavailableDates: [],
    isActive: true
  }
}));
const seed = async () => {
  try {
    await connectDatabase();

    if (!process.argv.includes('--full')) {
      await ensureFirstAdmin();
      await ensureDefaultOperator();
      console.log('Admin/operator seed complete. Public registration remains citizen-only.');
      process.exit(0);
    }

    await User.deleteMany({});
    await Service.deleteMany({});
    await Center.deleteMany({});
    await Ticket.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await Role.deleteMany({});
    await Counter.deleteMany({});
    await Announcement.deleteMany({});
    await SystemConfig.deleteMany({});
    await Setting.deleteMany({});
    await QueueHistory.deleteMany({});
    await Feedback.deleteMany({});
    await ContactMessage.deleteMany({});
    console.log('Existing database records cleared.');

    const roles = await Role.create([
      { name: 'admin', permissions: ['all'], description: 'Admin account for National ID appointments and office settings.' },
      { name: 'operator', permissions: ['serve_tickets', 'view_queue'], description: 'Counter operator for National ID queue management.' },
      { name: 'super_operator', permissions: ['serve_tickets', 'view_queue', 'manage_center_operators'], description: 'Senior counter operator for one assigned center.' },
      { name: 'citizen', permissions: ['create_bookings', 'view_own_tickets'], description: 'Citizen account for National ID appointments and queue tracking.' }
    ]);
    console.log(`Seeded ${roles.length} roles.`);

    const createdServices = await Service.create(servicesData);
    console.log(`Seeded ${createdServices.length} National ID service.`);

    const createdCenters = await Center.create(centersData);
    console.log(`Seeded ${createdCenters.length} Banaadir National ID centers.`);

    const countersList = [];
    createdCenters.forEach((center) => {
      for (let i = 1; i <= Math.min(3, center.counters); i += 1) {
        countersList.push({
          center: center._id,
          lastNumber: 10 + i,
          prefix: center.city.slice(0, 3).toUpperCase()
        });
      }
    });
    const createdCounters = await Counter.create(countersList);
    console.log(`Seeded ${createdCounters.length} counters.`);

    const admin = await User.create({
      name: FIRST_ADMIN.name,
      username: FIRST_ADMIN.username,
      email: 'admin.nqs@gov.so',
      phone: '+252 61 000 0001',
      password: FIRST_ADMIN.password,
      role: FIRST_ADMIN.role,
      status: FIRST_ADMIN.status
    });

    const operator = await User.create({
      name: 'National ID Operator',
      username: 'operator',
      email: 'operator.nqs@gov.so',
      phone: '+252 61 000 0002',
      password: DEFAULT_OPERATOR.password,
      role: 'operator',
      operatorType: 'operator',
      status: 'active',
      center: createdCenters[0]._id
    });

    const citizens = await User.create([
      {
        name: 'Amina Ali',
        username: 'amina',
        email: 'amina.ali@gov.so',
        phone: '+252 61 000 0003',
        password: 'password123',
        role: 'citizen',
        nationalId: 'SO-100200300',
        address: 'Hodan District, Banaadir'
      },
      {
        name: 'Mohamed Hassan',
        username: 'mohamed',
        email: 'mohamed.hassan@gov.so',
        phone: '+252 61 000 0004',
        password: 'password123',
        role: 'citizen',
        nationalId: 'SO-200300400',
        address: 'Wadajir District, Banaadir'
      },
      {
        name: 'Fadumo Nur',
        username: 'fadumo',
        email: 'fadumo.nur@gov.so',
        phone: '+252 61 000 0005',
        password: 'password123',
        role: 'citizen',
        nationalId: 'SO-300400500',
        address: 'Hamar Weyne District, Banaadir'
      },
      {
        name: 'Abdirahman Yusuf',
        username: 'abdirahman',
        email: 'abdirahman.yusuf@gov.so',
        phone: '+252 61 000 0006',
        password: 'password123',
        role: 'citizen',
        nationalId: 'SO-400500600',
        address: 'Kaaraan District, Banaadir'
      },
      {
        name: 'Sahra Ahmed',
        username: 'sahra',
        email: 'sahra.ahmed@gov.so',
        phone: '+252 61 000 0007',
        password: 'password123',
        role: 'citizen',
        nationalId: 'SO-500600700',
        address: 'Yaqshiid District, Banaadir'
      }
    ]);
    const citizen = citizens[0];
    console.log('Seeded default National ID users.');

    await Setting.create([
      { user: admin._id, darkMode: false, language: 'en', notificationsEnabled: true, emailNotif: true, smsNotif: true, pushNotif: true },
      { user: operator._id, darkMode: true, language: 'en', notificationsEnabled: true, emailNotif: true, smsNotif: true, pushNotif: true },
      ...citizens.map((citizenUser) => ({
        user: citizenUser._id,
        darkMode: false,
        language: 'en',
        notificationsEnabled: true,
        emailNotif: true,
        smsNotif: true,
        pushNotif: true
      }))
    ]);
    console.log('Seeded National ID user settings.');

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ticketsData = [
      { ref: 'NQS-1023', service: createdServices[0]._id, citizenName: 'Mohamed Hassan', citizen: citizens[1]._id, counter: 'Counter 01', waitTime: '0 min', status: 'Being Served', center: createdCenters[0]._id, date: todayStr, timeSlot: '09:00 AM', calledAt: new Date() },
      { ref: 'NQS-1024', service: createdServices[0]._id, citizenName: 'Fadumo Nur', citizen: citizens[2]._id, counter: '--', waitTime: '15 min', status: 'Waiting', center: createdCenters[0]._id, date: todayStr, timeSlot: '09:30 AM' },
      { ref: 'NQS-1025', service: createdServices[0]._id, citizenName: 'Abdirahman Yusuf', citizen: citizens[3]._id, counter: '--', waitTime: '30 min', status: 'Waiting', center: createdCenters[1]._id, date: todayStr, timeSlot: '10:00 AM' },
      { ref: 'NQS-1026', service: createdServices[0]._id, citizenName: 'Sahra Ahmed', citizen: citizens[4]._id, counter: '--', waitTime: '45 min', status: 'Waiting', center: createdCenters[2]._id, date: todayStr, timeSlot: '10:30 AM' },
      { ref: 'NQS-1027', service: createdServices[0]._id, citizenName: 'Citizen 1027', counter: '--', waitTime: '60 min', status: 'Waiting', center: createdCenters[3]._id, date: todayStr, timeSlot: '11:00 AM' },
      { ref: 'NQS-3041', service: createdServices[0]._id, citizenName: 'Amina Ali', citizen: citizen._id, counter: '--', waitTime: '20 min', status: 'Waiting', center: createdCenters[0]._id, date: todayStr, timeSlot: '11:30 AM' },
      {
        ref: 'NQS-4120',
        service: createdServices[1]._id,
        citizenName: 'Mohamed Hassan',
        citizen: citizens[1]._id,
        counter: '--',
        waitTime: '15 min',
        status: 'Waiting',
        requestType: 'lost_replacement',
        requestStatus: 'Pending',
        replacementDetails: {
          fullName: 'Mohamed Hassan',
          email: 'mohamed.hassan@gov.so',
          phone: '+252 61 000 0004',
          nationalIdNumber: 'SO-200300400',
          reason: 'National ID card was lost while traveling to work.',
          dateLost: todayStr,
          placeLost: 'Yaqshiid District, Mogadishu',
          policeReportNumber: 'PR-2026-4120',
          additionalNotes: 'Citizen will bring the police report copy to the appointment.'
        },
        center: createdCenters[6]._id,
        date: tomorrowStr,
        timeSlot: '09:00 AM'
      },
      {
        ref: 'NQS-5030',
        service: createdServices[2]._id,
        citizenName: 'Sahra Ahmed',
        citizen: citizens[4]._id,
        counter: '--',
        waitTime: '20 min',
        status: 'Waiting',
        requestType: 'update_information',
        requestStatus: 'Pending',
        updateDetails: {
          fullName: 'Sahra Ahmed',
          email: 'sahra.ahmed@gov.so',
          phone: '+252 61 000 0007',
          nationalIdNumber: 'SO-500600700',
          fieldToUpdate: 'Phone Number',
          currentValue: '+252 61 000 0007',
          newValue: '+252 61 222 0007',
          reason: 'Citizen changed mobile number.',
          notes: 'Citizen will bring supporting phone ownership details.'
        },
        center: createdCenters[1]._id,
        date: tomorrowStr,
        timeSlot: '10:30 AM'
      },
      { ref: 'NQS-7012', service: createdServices[0]._id, citizenName: 'Citizen 7012', counter: '--', waitTime: '0 min', status: 'Completed', center: createdCenters[4]._id, date: todayStr, timeSlot: '08:30 AM', calledAt: new Date(Date.now() - 30 * 60 * 1000), completedAt: new Date() },
      { ref: 'NQS-9031', service: createdServices[0]._id, citizenName: 'Citizen 9031', counter: '--', waitTime: '0 min', status: 'Cancelled', center: createdCenters[2]._id, date: todayStr, timeSlot: '01:00 PM' }
    ];
    const createdTickets = await Ticket.create(ticketsData);
    console.log(`Seeded ${createdTickets.length} National ID queue tickets.`);

    const citizenLabels = ['Citizen A', 'Citizen B', 'Citizen C', 'Citizen D', 'Citizen E'];
    const pastDaysHistory = [];
    const statusOptions = ['Completed', 'Completed', 'Completed', 'Cancelled'];
    for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
      const targetDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
      const targetDateStr = targetDate.toISOString().slice(0, 10);
      for (let ticketIndex = 1; ticketIndex <= 18; ticketIndex += 1) {
        const service = createdServices[(ticketIndex + dayOffset) % createdServices.length];
        const center = createdCenters[(ticketIndex + dayOffset) % createdCenters.length];
        const status = statusOptions[(ticketIndex + dayOffset) % statusOptions.length];
        pastDaysHistory.push({
          ticketRef: `NQS-${1000 + ticketIndex + dayOffset * 50}`,
          service: service._id,
          center: center._id,
          citizenName: citizenLabels[ticketIndex % citizenLabels.length],
          counter: `Counter 0${1 + (ticketIndex % 3)}`,
          waitTime: 5 + ((ticketIndex + dayOffset) % 30),
          serviceTime: 5 + ((ticketIndex + dayOffset) % 20),
          status,
          date: targetDateStr,
          completedAt: targetDate
        });
      }
    }
    const seededHistory = await QueueHistory.create(pastDaysHistory);
    console.log(`Seeded ${seededHistory.length} National ID QueueHistory records.`);

    await Notification.create([
      { user: citizen._id, title: 'National ID Appointment Confirmed', desc: 'Your ticket NQS-3041 for National ID Registration has been created.', category: 'Appointments', read: false },
      { user: citizens[1]._id, title: 'Replacement Request Submitted', desc: 'Your lost National ID replacement request NQS-4120 is scheduled for tomorrow.', category: 'Appointments', read: false },
      { user: citizens[4]._id, title: 'Update Request Submitted', desc: 'Your National ID information update request NQS-5030 is scheduled for tomorrow.', category: 'Appointments', read: false },
      { user: citizens[1]._id, title: 'Queue Alert', desc: 'Your ticket NQS-1023 is being called to Counter 01.', category: 'Queue', read: false },
      { user: citizen._id, title: 'Welcome to NQS', desc: 'Use your account to book a National ID appointment and track your queue ticket.', category: 'System', read: true },
      { user: null, title: 'Center Notice', desc: 'National ID centers in Banaadir are operating during standard government hours.', category: 'System', read: false }
    ]);
    console.log('Seeded National ID notifications.');

    await AuditLog.create([
      { user: admin._id, role: 'admin', action: 'System Setup', details: 'Initialized National ID service data for Banaadir centers.', ipAddress: '127.0.0.1' },
      { user: citizen._id, role: 'citizen', action: 'User Registration', details: 'Created citizen account for amina.ali@gov.so', ipAddress: '127.0.0.1' },
      { user: operator._id, role: 'operator', action: 'User Login', details: 'Operator account operator.nqs@gov.so signed in.', ipAddress: '127.0.0.1' },
      { user: citizen._id, role: 'citizen', action: 'Book Appointment', details: 'Booked National ID appointment NQS-3041.', ipAddress: '127.0.0.1' },
      { user: admin._id, role: 'admin', action: 'Update Appointment', details: 'Reviewed appointment NQS-1024 from the admin appointments page.', ipAddress: '127.0.0.1' },
      { user: operator._id, role: 'operator', action: 'Call Next Ticket', details: 'Called ticket NQS-1023 to Counter 01.', ipAddress: '127.0.0.1' },
      { user: admin._id, role: 'admin', action: 'Cancel Booking', details: 'Cancelled ticket NQS-9031 after citizen request.', ipAddress: '127.0.0.1' }
    ]);
    console.log('Seeded National ID audit logs.');

    await Feedback.create([
      { user: citizen._id, rating: 5, comment: 'The National ID booking and queue tracking process is clear and easy to use.' },
      { user: citizen._id, rating: 4, comment: 'The digital queue ticket made the center visit faster.' }
    ]);
    console.log('Seeded National ID feedback.');

    await ContactMessage.create([
      {
        fullName: 'Amina Ali',
        email: 'amina.ali@gov.so',
        phone: '+252 61 000 0003',
        message: 'I would like to confirm the documents required for my National ID appointment.',
        status: 'New'
      },
      {
        fullName: 'Mohamed Hassan',
        email: 'mohamed.hassan@gov.so',
        phone: '+252 61 000 0004',
        message: 'Please confirm if I can visit the Wadajir center for my scheduled appointment.',
        status: 'In Review'
      }
    ]);
    console.log('Seeded National ID contact messages.');

    await Announcement.create([
      { title: 'National ID Center Hours', message: 'Banaadir National ID centers are open during standard government service hours.', createdBy: admin._id, expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
      { title: 'Digital Ticket Notice', message: 'QR ticket verification and live queue tracking are available for National ID appointments.', createdBy: admin._id, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
    ]);
    console.log('Seeded National ID announcements.');

    await SystemConfig.create([
      { key: 'portalName', value: 'National ID Appointment System', description: 'Public site name' },
      { key: 'maintenanceMode', value: false, description: 'Disables appointment booking when true' },
      { key: 'maxWaitTimeWarning', value: 45, description: 'Queue wait warning threshold in minutes' },
      {
        key: 'appointmentSchedule',
        value: {
          workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
          dayOff: ['Friday'],
          startTime: '08:00 AM',
          endTime: '04:00 PM',
          maxAppointmentsPerSlot: 1,
          maxAppointmentsPerDay: 120
        },
        description: 'Appointment calendar and capacity controls'
      }
    ]);
    console.log('Seeded National ID system configurations.');

    console.log('National ID NQS database seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seed();
