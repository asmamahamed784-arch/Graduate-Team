import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma.js';

const apply = process.argv.includes('--apply');
const backupDir = path.resolve(process.cwd(), 'database', 'backups');

const writeBackup = async (name, data) => {
  await fs.promises.mkdir(backupDir, { recursive: true });
  const file = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.json`);
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
};

const main = async () => {
  const centers = await prisma.center.findMany({ select: { id: true, name: true, district: true } });
  const centerIds = new Set(centers.map((center) => center.id));

  const users = await prisma.user.findMany();
  const tickets = await prisma.ticket.findMany();
  const accountProfiles = await prisma.accountProfile.findMany();

  const orphanUsers = users.filter((user) => user.center && !centerIds.has(user.center));
  const orphanTickets = tickets.filter((ticket) => ticket.center && !centerIds.has(ticket.center));
  const orphanProfiles = accountProfiles.filter((profile) => profile.center && !centerIds.has(profile.center));

  const deleteUserIds = new Set(orphanUsers.map((user) => user.id));
  const deleteTicketRefs = new Set(orphanTickets.map((ticket) => ticket.ref));
  const deleteTicketIds = new Set(orphanTickets.map((ticket) => ticket.id));

  const backup = {
    createdAt: new Date().toISOString(),
    centers,
    orphanUsers,
    orphanTickets,
    orphanProfiles
  };
  const backupFile = await writeBackup('orphan-cleanup', backup);

  const summary = {
    backupFile,
    apply,
    centers: centers.length,
    orphanUsers: orphanUsers.length,
    orphanTickets: orphanTickets.length,
    orphanProfiles: orphanProfiles.length
  };

  if (!apply) {
    console.log(JSON.stringify({ ...summary, message: 'Dry run only. Run with --apply to delete orphan data.' }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (deleteTicketRefs.size) {
      await tx.qRScan.deleteMany({ where: { ticketRef: { in: [...deleteTicketRefs] } } });
      await tx.queueHistory.deleteMany({ where: { ticketRef: { in: [...deleteTicketRefs] } } });
      await tx.feedback.deleteMany({ where: { ticket: { in: [...deleteTicketIds] } } });
      await tx.document.deleteMany({ where: { ticket: { in: [...deleteTicketIds] } } });
      await tx.requestCorrectionFeedback.deleteMany({ where: { request: { in: [...deleteTicketIds] } } });
      await tx.requestCorrectionHistory.deleteMany({ where: { request: { in: [...deleteTicketIds] } } });
      await tx.notification.deleteMany({
        where: {
          OR: [
            { referenceNumber: { in: [...deleteTicketRefs] } },
            { relatedEntity: { in: [...deleteTicketIds] } }
          ]
        }
      });
      await tx.otpCode.deleteMany({ where: { ticket: { in: [...deleteTicketIds] } } });
      await tx.ticket.deleteMany({ where: { id: { in: [...deleteTicketIds] } } });
    }

    if (deleteUserIds.size) {
      await tx.activeSession.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.setting.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.document.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.feedback.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.notification.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.otpCode.deleteMany({ where: { user: { in: [...deleteUserIds] } } });
      await tx.accountProfile.deleteMany({ where: { userId: { in: [...deleteUserIds] } } });
      await tx.citizen.deleteMany({ where: { userId: { in: [...deleteUserIds] } } });
      await tx.user.deleteMany({ where: { id: { in: [...deleteUserIds] } } });
    }

    if (orphanProfiles.length) {
      await tx.accountProfile.deleteMany({ where: { id: { in: orphanProfiles.map((profile) => profile.id) } } });
    }
  });

  console.log(JSON.stringify({ ...summary, message: 'Orphan database cleanup completed.' }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
