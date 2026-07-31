import prisma from '../config/prisma.js';

const STAFF_ACCOUNT_ROLES = new Set([
  'admin',
  'operator',
  'super_operator',
  'center_manager',
  'user_manager'
]);

const normalizeRole = (role = '') => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const main = async () => {
  const users = await prisma.user.findMany();
  let synced = 0;

  for (const user of users) {
    const role = normalizeRole(user.role);
    if (!STAFF_ACCOUNT_ROLES.has(role)) continue;

    const data = {
      name: user.name || user.username,
      email: user.email || null,
      phone: user.phone || '',
      status: user.status || 'active',
      operatorType: user.operatorType || role,
      mustChangePassword: Boolean(user.mustChangePassword),
      lastActiveAt: user.lastActiveAt || null,
      center: user.center || null,
      assignedDistrict: user.assignedDistrict || '',
      district: user.district || ''
    };

    await prisma.accountProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        ...data
      }
    });

    synced += 1;
  }

  console.log(`Synced ${synced} account profiles.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
