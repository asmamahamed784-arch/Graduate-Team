import prisma from '../config/prisma.js';

const splitName = (name = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts.length > 1 ? parts[parts.length - 1] : ''
  };
};

const run = async () => {
  const users = await prisma.user.findMany({
    where: { role: { in: ['citizen', 'user'] } }
  });

  let synced = 0;
  for (const user of users) {
    const fullName = String(user.name || user.username || '').trim();
    const parts = splitName(fullName);
    await prisma.citizen.upsert({
      where: { userId: user.id },
      update: {
        fullName,
        firstName: user.firstName || parts.firstName,
        middleName: user.middleName || parts.middleName,
        lastName: user.lastName || parts.lastName,
        email: user.email || null,
        phone: user.phone || '',
        nationalId: user.nationalId || '',
        nationalIdStatus: user.nationalIdStatus || 'NOT_STARTED',
        cardSerialNumber: user.cardSerialNumber || '',
        cardStatus: user.cardStatus || 'NOT_ISSUED',
        cardIssueDate: user.cardIssueDate || null,
        cardExpiryDate: user.cardExpiryDate || null,
        replacementCount: user.replacementCount || 0,
        approvedRegistration: user.approvedRegistration || null,
        photo: user.photo || '',
        dateOfBirth: user.dateOfBirth || '',
        address: user.address || '',
        district: user.district || '',
        maritalStatus: user.maritalStatus || '',
        center: user.center || null,
        cardHistory: user.cardHistory || null
      },
      create: {
        userId: user.id,
        fullName,
        firstName: user.firstName || parts.firstName,
        middleName: user.middleName || parts.middleName,
        lastName: user.lastName || parts.lastName,
        email: user.email || null,
        phone: user.phone || '',
        nationalId: user.nationalId || '',
        nationalIdStatus: user.nationalIdStatus || 'NOT_STARTED',
        cardSerialNumber: user.cardSerialNumber || '',
        cardStatus: user.cardStatus || 'NOT_ISSUED',
        cardIssueDate: user.cardIssueDate || null,
        cardExpiryDate: user.cardExpiryDate || null,
        replacementCount: user.replacementCount || 0,
        approvedRegistration: user.approvedRegistration || null,
        photo: user.photo || '',
        dateOfBirth: user.dateOfBirth || '',
        address: user.address || '',
        district: user.district || '',
        maritalStatus: user.maritalStatus || '',
        center: user.center || null,
        cardHistory: user.cardHistory || null
      }
    });
    synced += 1;
  }

  console.log(`Synced ${synced} citizen profiles.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
