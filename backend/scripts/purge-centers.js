import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../config/prisma.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const namesArg = args.find((arg) => arg.startsWith('--names='));
const idsArg = args.find((arg) => arg.startsWith('--ids='));

const splitList = (value = '') => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const names = splitList(namesArg?.replace(/^--names=/, '') || '');
const ids = splitList(idsArg?.replace(/^--ids=/, '') || '');

if (!names.length && !ids.length) {
  console.error('Usage: node scripts/purge-centers.js --apply --names="Old Center,Test"');
  await prisma.$disconnect();
  process.exit(1);
}

const centerWhere = {
  OR: [
    ...(ids.length ? [{ id: { in: ids } }] : []),
    ...(names.length ? [{ name: { in: names } }] : [])
  ]
};

const centerReferenceWhere = (center) => ({
  OR: [
    { center: center.id },
    { center: center.name }
  ]
});

const backupDir = path.join(process.cwd(), 'database', 'backups');
await fs.mkdir(backupDir, { recursive: true });

const centers = await prisma.center.findMany({ where: centerWhere });
if (!centers.length) {
  console.log('No matching centers found. Database is already clean for those names/ids.');
  await prisma.$disconnect();
  process.exit(0);
}

const centerIds = centers.map((center) => center.id);
const centerNames = centers.map((center) => center.name);
const tickets = await prisma.ticket.findMany({
  where: {
    OR: [
      { center: { in: centerIds } },
      { center: { in: centerNames } }
    ]
  }
});
const staffUsers = await prisma.user.findMany({
  where: {
    role: { in: ['operator', 'super_operator', 'center_manager'] },
    OR: [
      { center: { in: centerIds } },
      { center: { in: centerNames } },
      { accountProfile: { center: { in: centerIds } } },
      { accountProfile: { center: { in: centerNames } } }
    ]
  }
});

const backup = {
  createdAt: new Date().toISOString(),
  apply,
  centers,
  tickets,
  staffUsers
};
const backupPath = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-purge-centers.json`);
await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

console.log(`Matched centers: ${centers.map((center) => center.name).join(', ')}`);
console.log(`Linked tickets: ${tickets.length}`);
console.log(`Linked staff accounts: ${staffUsers.length}`);
console.log(`Backup written: ${backupPath}`);

if (!apply) {
  console.log('Dry run only. Add --apply to delete these records.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  for (const center of centers) {
    const linkedTickets = await tx.ticket.findMany({
      where: centerReferenceWhere(center),
      select: { id: true, ref: true }
    });
    const ticketIds = linkedTickets.map((ticket) => ticket.id);
    const ticketRefs = linkedTickets.map((ticket) => ticket.ref).filter(Boolean);

    const linkedStaff = await tx.user.findMany({
      where: {
        role: { in: ['operator', 'super_operator', 'center_manager'] },
        OR: [
          { center: center.id },
          { center: center.name },
          { accountProfile: { center: center.id } },
          { accountProfile: { center: center.name } }
        ]
      },
      select: { id: true }
    });
    const staffIds = linkedStaff.map((user) => user.id);

    await tx.notification.deleteMany({
      where: {
        OR: [
          { relatedEntity: center.id },
          { relatedEntity: center.name },
          ...(ticketIds.length ? [{ relatedEntity: { in: ticketIds } }] : []),
          ...(ticketRefs.length ? [{ referenceNumber: { in: ticketRefs } }] : [])
        ]
      }
    });

    if (ticketIds.length) {
      await tx.document.deleteMany({ where: { ticket: { in: ticketIds } } });
      await tx.feedback.deleteMany({ where: { ticket: { in: ticketIds } } });
      await tx.otpCode.deleteMany({ where: { ticket: { in: ticketIds } } });
    }
    if (ticketRefs.length) {
      await tx.qRScan.deleteMany({ where: { ticketRef: { in: ticketRefs } } });
      await tx.queueHistory.deleteMany({ where: { ticketRef: { in: ticketRefs } } });
    }

    await tx.queueHistory.deleteMany({ where: centerReferenceWhere(center) });
    await tx.counter.deleteMany({ where: centerReferenceWhere(center) });
    await tx.ticket.deleteMany({ where: centerReferenceWhere(center) });
    await tx.citizen.updateMany({ where: centerReferenceWhere(center), data: { center: null } });
    await tx.user.updateMany({ where: { role: 'citizen', ...centerReferenceWhere(center) }, data: { center: null } });

    if (staffIds.length) {
      await tx.activeSession.deleteMany({ where: { user: { in: staffIds } } });
      await tx.setting.deleteMany({ where: { user: { in: staffIds } } });
      await tx.otpCode.deleteMany({ where: { user: { in: staffIds } } });
      await tx.user.deleteMany({ where: { id: { in: staffIds } } });
    }

    await tx.accountProfile.deleteMany({ where: centerReferenceWhere(center) });
    await tx.center.delete({ where: { id: center.id } });
  }
});

console.log('Selected centers and linked records were deleted.');
await prisma.$disconnect();
