import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import {
  NATIONAL_ID_CORE_SERVICES
} from './nqsScope.js';

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'Admin@123',
  role: 'admin',
  name: 'System Admin',
  email: 'admin.nqs@gov.so',
  phone: '+252 61 000 0001'
};

const passwordHash = (password) => bcrypt.hash(password, 10);

const seedServices = async () => {
  for (const service of NATIONAL_ID_CORE_SERVICES) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: {
        description: service.description,
        category: service.category,
        duration: service.duration,
        requirements: service.requirements,
        priority: service.priority,
        status: 'Active'
      },
      create: {
        ...service,
        status: 'Active'
      }
    });
  }
};

const seedCenters = async () => {
  // Centers are managed by the admin UI. Do not auto-create district centers.
  return null;
};

const seedRoles = async () => {
  const roles = [
    ['admin', 'Administrator with full access.'],
    ['operator', 'Counter operator for National ID queue management.'],
    ['super_operator', 'Center manager for an assigned center.'],
    ['center_manager', 'Center manager alias for assigned-center operations.'],
    ['user_manager', 'User management officer for citizen accounts.'],
    ['citizen', 'Citizen account for appointments and queue tracking.']
  ];

  for (const [name, description] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description }
    });
  }
};

const seedUsers = async () => {
  await prisma.user.upsert({
    where: { username: DEFAULT_ADMIN.username },
    update: {
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      phone: DEFAULT_ADMIN.phone,
      role: DEFAULT_ADMIN.role,
      status: 'active'
    },
    create: {
      ...DEFAULT_ADMIN,
      password: await passwordHash(DEFAULT_ADMIN.password),
      status: 'active'
    }
  });
};

const resetDemoData = async () => {
  await prisma.$transaction([
    prisma.requestCorrectionHistory.deleteMany(),
    prisma.requestCorrectionFeedback.deleteMany(),
    prisma.qRScan.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.document.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.queueHistory.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.counter.deleteMany()
  ]);
};

const run = async () => {
  if (process.argv.includes('--full')) {
    await resetDemoData();
  }

  await seedRoles();
  await seedServices();
  await seedCenters();
  await seedUsers();

  const [centers, services, users] = await Promise.all([
    prisma.center.count(),
    prisma.service.count(),
    prisma.user.count()
  ]);

  console.log(`PostgreSQL seed complete. Centers: ${centers}, services: ${services}, users: ${users}`);
  console.log(`Admin: ${DEFAULT_ADMIN.username} / ${DEFAULT_ADMIN.password}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
