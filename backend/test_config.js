
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.systemConfig.findMany().then(r => console.log('Configs:', r)).catch(console.error).finally(() => prisma.$disconnect());

