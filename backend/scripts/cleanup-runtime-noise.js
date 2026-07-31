import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma.js';

const backupDir = path.resolve(process.cwd(), 'database', 'backups');

const writeBackup = async (name, data) => {
  await fs.promises.mkdir(backupDir, { recursive: true });
  const file = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.json`);
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
};

const main = async () => {
  const [sessions, otps, smsLogs] = await Promise.all([
    prisma.activeSession.findMany(),
    prisma.otpCode.findMany(),
    prisma.sMSLog.findMany()
  ]);

  const backupFile = await writeBackup('runtime-cleanup', {
    createdAt: new Date().toISOString(),
    activeSessions: sessions,
    otpCodes: otps,
    smsLogs
  });

  const result = await prisma.$transaction(async (tx) => {
    const activeSessions = await tx.activeSession.deleteMany({});
    const otpCodes = await tx.otpCode.deleteMany({});
    const smsLogs = await tx.sMSLog.deleteMany({});
    return { activeSessions, otpCodes, smsLogs };
  });

  console.log(JSON.stringify({
    backupFile,
    deleted: {
      activeSessions: result.activeSessions.count,
      otpCodes: result.otpCodes.count,
      smsLogs: result.smsLogs.count
    }
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
