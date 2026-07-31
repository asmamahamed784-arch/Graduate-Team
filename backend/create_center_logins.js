import bcrypt from 'bcryptjs';
import prisma from './config/prisma.js';
import { getCenterDistrict } from './utils/nqsScope.js';

const PASSWORD = 'Center@123';

const usernameFromCenter = (center) => {
  const base = String(center.name || center.district || 'center')
    .toLowerCase()
    .replace(/\bnational\b/g, '')
    .replace(/\bid\b/g, '')
    .replace(/\bcenter\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return `${base || 'center'}manager`;
};

const districtUsernameFromCenter = (center) => {
  const base = String(center.name || center.district || 'center')
    .toLowerCase()
    .replace(/\bnational\b/g, '')
    .replace(/\bid\b/g, '')
    .replace(/\bcenter\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return `${base || 'center'}center`;
};

const upsertCenterAccount = async ({ center, username, password }) => prisma.user.upsert({
  where: { username },
  update: {
    name: `${center.name} Login`,
    phone: center.phone || '',
    password,
    role: 'super_operator',
    operatorType: 'super_operator',
    status: 'active',
    center: center.id,
    assignedDistrict: getCenterDistrict(center),
    mustChangePassword: false
  },
  create: {
    name: `${center.name} Login`,
    username,
    phone: center.phone || '',
    password,
    role: 'super_operator',
    operatorType: 'super_operator',
    status: 'active',
    center: center.id,
    assignedDistrict: getCenterDistrict(center),
    mustChangePassword: false
  }
});

const run = async () => {
  const centers = await prisma.center.findMany({
    orderBy: [{ district: 'asc' }, { name: 'asc' }]
  });
  const password = await bcrypt.hash(PASSWORD, 10);

  const accounts = [];
  for (const center of centers) {
    const usernames = [...new Set([usernameFromCenter(center), districtUsernameFromCenter(center)])];
    await Promise.all(usernames.map((username) => upsertCenterAccount({ center, username, password })));

    usernames.forEach((username) => accounts.push({
      center: center.name,
      district: center.district,
      username,
      password: PASSWORD
    }));
  }

  console.table(accounts);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
